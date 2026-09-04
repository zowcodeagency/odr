import { and, desc, eq, sql } from "drizzle-orm";
import type { DB } from "@odr/db";
import { tenants, topups, outlets, users, memberships } from "@odr/db/schema";
import type { AdminRepo, TenantRow, TopupRow } from "./ports.ts";

const tenantCols = {
  id: tenants.id,
  name: tenants.name,
  slug: tenants.slug,
  subscriptionStart: tenants.subscriptionStart,
  subscriptionEnd: tenants.subscriptionEnd,
  localBilling: tenants.localBilling,
  createdAt: tenants.createdAt,
  outletCount: sql<number>`(select count(*)::int from ${outlets} o where o.tenant_id = ${tenants.id})`,
};

const toTenant = (r: {
  id: string;
  name: string;
  slug: string;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
  localBilling: boolean;
  createdAt: Date;
  outletCount: number;
}): TenantRow => ({ ...r, createdAt: r.createdAt.toISOString() });

const toTopup = (r: {
  id: string;
  amountMinor: string;
  monthsAdded: number;
  note: string | null;
  createdAt: Date;
}): TopupRow => ({ ...r, createdAt: r.createdAt.toISOString() });

export const drizzleAdminRepo = (db: DB): AdminRepo => ({
  async slugExists(slug) {
    const rows = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
    return rows.length > 0;
  },

  async createTenant(input) {
    const [t] = await db.insert(tenants).values(input).returning(tenantCols);
    if (!t) throw new Error("failed to insert tenant");
    return toTenant(t);
  },

  async listTenants() {
    const rows = await db.select(tenantCols).from(tenants).orderBy(desc(tenants.createdAt));
    return rows.map(toTenant);
  },

  async tenantById(id) {
    const rows = await db.select(tenantCols).from(tenants).where(eq(tenants.id, id)).limit(1);
    return rows[0] ? toTenant(rows[0]) : null;
  },

  async setSubscriptionEnd(tenantId, end) {
    await db.update(tenants).set({ subscriptionEnd: end }).where(eq(tenants.id, tenantId));
  },

  async setLocalBilling(tenantId, on) {
    const rows = await db.update(tenants).set({ localBilling: on }).where(eq(tenants.id, tenantId)).returning({ id: tenants.id });
    return rows.length > 0;
  },
  async listOutlets(tenantId) {
    const rows = await db.select().from(outlets).where(eq(outlets.tenantId, tenantId)).orderBy(outlets.createdAt);
    return rows.map((o) => ({
      id: o.id,
      name: o.name,
      code: o.code,
      gstin: o.gstin,
      city: o.address.city,
      invoicePrefix: o.invoicePrefix,
      isActive: o.isActive,
      menuMode: o.menuMode,
      createdAt: o.createdAt.toISOString(),
    }));
  },

  async outletCodeExists(tenantId, code) {
    const rows = await db
      .select({ id: outlets.id })
      .from(outlets)
      .where(and(eq(outlets.tenantId, tenantId), eq(outlets.code, code)))
      .limit(1);
    return rows.length > 0;
  },

  async createOutlet({ tenantId, name, code, gstin, address, invoicePrefix, menuMode }) {
    const [o] = await db
      .insert(outlets)
      .values({ tenantId, name, code, gstin, address, invoicePrefix, menuMode })
      .returning({ id: outlets.id });
    if (!o) throw new Error("failed to insert outlet");
    return o;
  },

  async setOutletActive(tenantId, outletId, isActive) {
    const rows = await db
      .update(outlets)
      .set({ isActive })
      .where(and(eq(outlets.tenantId, tenantId), eq(outlets.id, outletId)))
      .returning({ id: outlets.id });
    return rows.length > 0;
  },

  async upsertOwner({ email, passwordHash, fullName }) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing[0]) return existing[0];
    const [u] = await db.insert(users).values({ email, passwordHash, fullName }).returning({ id: users.id });
    if (!u) throw new Error("failed to insert user");
    return u;
  },

  async addOwnerMembership(tenantId, userId) {
    await db.insert(memberships).values({ tenantId, userId, role: "owner" }).onConflictDoNothing();
  },

  async insertTopup(input) {
    const [t] = await db.insert(topups).values(input).returning();
    if (!t) throw new Error("failed to insert topup");
    return toTopup(t);
  },

  async listTopups(tenantId) {
    const rows = await db.select().from(topups).where(eq(topups.tenantId, tenantId)).orderBy(desc(topups.createdAt));
    return rows.map(toTopup);
  },
});
