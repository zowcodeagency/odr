import { hashPassword } from "@odr/auth";
import type { MenuMode } from "@odr/db/schema";
import { Money, NotFoundError, asTenantId, asUserId } from "@odr/shared";
import { runWithContext } from "@odr/tenancy";
import type { MenuService } from "../menu/service.ts";
import type { AdminRepo, TopupRow } from "./ports.ts";
import {
  addMonths,
  extendSubscription,
  invoicePrefixFor,
  outletCodeFor,
  slugify,
  subscriptionStatus,
  type ImportCategory,
} from "./domain.ts";

export type AdminServiceDeps = { repo: AdminRepo; menu: MenuService };

// Admin writes are attributed to the tenant, not to a user — there are no admin
// accounts (ADMIN_KEY only), so menu imports run under the nil uuid as owner.
const ADMIN_ACTOR = "00000000-0000-0000-0000-000000000000";

// ponytail: manual sales are India-only today; revisit when a SAR tenant lands.
const CURRENCY = "INR" as const;

const viewTopup = (t: TopupRow) => ({
  id: t.id,
  amount: Money.fromMinor(BigInt(t.amountMinor), CURRENCY).toMajor(),
  amountMinor: t.amountMinor,
  monthsAdded: t.monthsAdded,
  note: t.note,
  createdAt: t.createdAt,
});

export const makeAdminService = ({ repo, menu }: AdminServiceDeps) => ({
  async createRestaurant(input: {
    name: string;
    ownerEmail: string;
    ownerPassword: string;
    ownerFullName: string;
    startDate: string;
    months: number;
    gstin?: string;
  }) {
    const base = slugify(input.name);
    const slug = (await repo.slugExists(base))
      ? `${base}-${Math.random().toString(36).slice(2, 6)}`
      : base;

    const subscriptionEnd = addMonths(input.startDate, input.months);
    const tenant = await repo.createTenant({
      name: input.name,
      slug,
      subscriptionStart: input.startDate,
      subscriptionEnd,
    });

    const outlet = await repo.createOutlet({
      tenantId: tenant.id,
      name: input.name,
      code: slug.toUpperCase(),
      gstin: input.gstin,
      // ponytail: the team fills the real address in later via /api/v1/outlets.
      address: { line1: "-", city: "-", state: "-", pincode: "-", country: "IN" },
      invoicePrefix: invoicePrefixFor(input.name),
      menuMode: "shared",
    });

    const owner = await repo.upsertOwner({
      email: input.ownerEmail,
      passwordHash: await hashPassword(input.ownerPassword),
      fullName: input.ownerFullName,
    });
    await repo.addOwnerMembership(tenant.id, owner.id);

    return {
      tenantId: tenant.id,
      outletId: outlet.id,
      userId: owner.id,
      slug,
      subscriptionStart: tenant.subscriptionStart,
      subscriptionEnd: tenant.subscriptionEnd,
    };
  },

  async listRestaurants() {
    const rows = await repo.listTenants();
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      subscriptionStart: t.subscriptionStart,
      subscriptionEnd: t.subscriptionEnd,
      localBilling: t.localBilling,
      createdAt: t.createdAt,
      outletCount: t.outletCount,
      ...subscriptionStatus(t.subscriptionEnd),
    }));
  },

  /** Special customers only: lets the app keep bills on the device (hold Settle & bill). */
  async setLocalBilling(tenantId: string, on: boolean) {
    if (!(await repo.setLocalBilling(tenantId, on))) throw new NotFoundError("tenant", tenantId);
    return { tenantId, localBilling: on };
  },
  listOutlets: async (tenantId: string) => {
    if (!(await repo.tenantById(tenantId))) throw new NotFoundError("tenant", tenantId);
    return repo.listOutlets(tenantId);
  },

  /** Second, third… outlet for a brand. `menuMode` is the "share the brand menu?" answer. */
  async createOutlet(tenantId: string, input: {
    name: string;
    gstin?: string;
    address: { line1: string; line2?: string; city: string; state: string; pincode: string; country: string };
    invoicePrefix?: string;
    menuMode: MenuMode;
  }) {
    if (!(await repo.tenantById(tenantId))) throw new NotFoundError("tenant", tenantId);
    const base = outletCodeFor(input.name);
    let code = base;
    for (let n = 2; await repo.outletCodeExists(tenantId, code); n++) {
      code = `${base.slice(0, 16 - 1 - String(n).length).replace(/-$/, "")}-${n}`;
    }
    const { id } = await repo.createOutlet({
      tenantId,
      name: input.name,
      code,
      gstin: input.gstin,
      address: input.address,
      invoicePrefix: input.invoicePrefix ?? invoicePrefixFor(input.name),
      menuMode: input.menuMode,
    });
    return { outletId: id, code };
  },

  async setOutletActive(tenantId: string, outletId: string, isActive: boolean) {
    if (!(await repo.setOutletActive(tenantId, outletId, isActive))) throw new NotFoundError("outlet", outletId);
    return { outletId, isActive };
  },

  async addTopup(tenantId: string, input: { amount: string | number; monthsAdded: number; note?: string }) {
    const tenant = await repo.tenantById(tenantId);
    if (!tenant) throw new NotFoundError("tenant", tenantId);

    const subscriptionEnd = extendSubscription(tenant.subscriptionEnd, input.monthsAdded);
    const topup = await repo.insertTopup({
      tenantId,
      amountMinor: Money.of(input.amount, CURRENCY).minor.toString(),
      monthsAdded: input.monthsAdded,
      note: input.note,
    });
    await repo.setSubscriptionEnd(tenantId, subscriptionEnd);

    return { subscriptionEnd, topup: viewTopup(topup) };
  },

  async listTopups(tenantId: string) {
    const tenant = await repo.tenantById(tenantId);
    if (!tenant) throw new NotFoundError("tenant", tenantId);
    return (await repo.listTopups(tenantId)).map(viewTopup);
  },

  /**
   * Bulk import through the real menu service — categories are matched by name
   * (created when missing), items are always created. Returns created counts.
   */
  async importMenu(tenantId: string, categories: ImportCategory[], outletId?: string) {
    const tenant = await repo.tenantById(tenantId);
    if (!tenant) throw new NotFoundError("tenant", tenantId);

    return runWithContext(
      { tenantId: asTenantId(tenantId), userId: asUserId(ADMIN_ACTOR), role: "owner" },
      async () => {
        const byName = new Map(
          (await menu.listCategories(outletId)).map((c) => [c.name.trim().toLowerCase(), c.id]),
        );
        let categoriesCreated = 0;
        let itemsCreated = 0;
        let itemsUpdated = 0;

        for (const cat of categories) {
          const key = cat.name.trim().toLowerCase();
          let categoryId = byName.get(key);
          if (!categoryId) {
            categoryId = (await menu.createCategory({ name: cat.name, outletId })).id;
            byName.set(key, categoryId);
            categoriesCreated++;
          }
          for (const item of cat.items) {
            // Upsert on (category, name): re-importing a corrected price
            // updates the dish instead of shadowing it with a duplicate.
            const { created } = await menu.upsertItem({
              categoryId,
              name: item.name,
              description: item.description,
              basePrice: item.price,
              taxClass: item.taxClass,
              isVeg: item.isVeg,
              outletId,
            });
            if (created) itemsCreated++;
            else itemsUpdated++;
          }
        }
        return { categoriesCreated, itemsCreated, itemsUpdated };
      },
    );
  },
});

export type AdminService = ReturnType<typeof makeAdminService>;
