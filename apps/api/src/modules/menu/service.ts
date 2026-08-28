import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@odr/shared";
import { can } from "@odr/auth";
import { getTaxStrategy } from "@odr/tax";
import type { EventBus } from "@odr/events";
import { getContext } from "@odr/tenancy";
import type { Item, ItemImage } from "./domain.ts";
import type { MenuRepo } from "./ports.ts";

export type MenuServiceDeps = {
  repo: MenuRepo;
  events: EventBus;
  country: () => string;
};

/** Menu names are matched the way a person would: trimmed, case-insensitive. */
const key = (name: string) => name.trim().toLowerCase();

const emit = (events: EventBus, name: string, tenantId: string, payload: unknown) =>
  events.publish({ name, tenantId, occurredAt: new Date().toISOString(), payload });

const assertTaxClass = (country: string, taxClass?: string) => {
  if (taxClass === undefined) return;
  const tax = getTaxStrategy(country);
  if (!tax.classes().includes(taxClass)) {
    throw new ValidationError(`invalid tax class for ${tax.country}`, {
      taxClass,
      allowed: tax.classes(),
    });
  }
};

const assertOutletInTenant = async (repo: MenuRepo, tenantId: string, outletId?: string) => {
  if (!outletId) return;
  if (!(await repo.outletExistsInTenant(tenantId, outletId))) {
    throw new NotFoundError("outlet", outletId);
  }
};

export const makeMenuService = ({ repo, events, country }: MenuServiceDeps) => ({
  listCategories: (outletId?: string) => repo.listCategories(getContext().tenantId, outletId),

  async createCategory(input: { outletId?: string; name: string; sortOrder?: number }) {
    const ctx = getContext();
    if (!can(ctx.role, "menu:write")) throw new ForbiddenError("cannot write menu");
    await assertOutletInTenant(repo, ctx.tenantId, input.outletId);
    const cat = await repo.createCategory(ctx.tenantId, input);
    await events.publish({
      name: "menu.category.created",
      tenantId: ctx.tenantId,
      occurredAt: new Date().toISOString(),
      payload: cat,
    });
    return cat;
  },

  listItems: (opts: { categoryId?: string; outletId?: string }) => repo.listItems(getContext().tenantId, opts),

  /** Dish photos are public content (the diner menu shows them) — no tenant context. */
  itemImage: (id: string) => repo.itemImage(id),

  async createItem(input: {
    outletId?: string;
    categoryId: string;
    name: string;
    description?: string;
    basePrice: string;
    taxClass: string;
    isVeg: boolean;
    image?: ItemImage | null;
  }) {
    const ctx = getContext();
    if (!can(ctx.role, "menu:write")) throw new ForbiddenError("cannot write menu");
    await assertOutletInTenant(repo, ctx.tenantId, input.outletId);

    const tax = getTaxStrategy(country());
    if (!tax.classes().includes(input.taxClass)) {
      throw new ValidationError(`invalid tax class for ${tax.country}`, {
        taxClass: input.taxClass,
        allowed: tax.classes(),
      });
    }

    const item = await repo.createItem(ctx.tenantId, input);
    await events.publish({
      name: "menu.item.created",
      tenantId: ctx.tenantId,
      occurredAt: new Date().toISOString(),
      payload: item,
    });
    return item;
  },

  async updateItem(id: string, patch: {
    name?: string;
    description?: string | null;
    basePrice?: string;
    taxClass?: string;
    isVeg?: boolean;
    isActive?: boolean;
    image?: ItemImage | null;
  }) {
    const ctx = getContext();
    if (!can(ctx.role, "menu:write")) throw new ForbiddenError("cannot write menu");
    assertTaxClass(country(), patch.taxClass);

    const item = await repo.updateItem(ctx.tenantId, id, patch);
    await emit(events, "menu.item.updated", ctx.tenantId, item);
    return item;
  },

  async deleteItem(id: string) {
    const ctx = getContext();
    if (!can(ctx.role, "menu:write")) throw new ForbiddenError("cannot write menu");
    await repo.deleteItem(ctx.tenantId, id);
    await emit(events, "menu.item.deleted", ctx.tenantId, { id });
  },

  async updateCategory(id: string, patch: { name?: string; sortOrder?: number }) {
    const ctx = getContext();
    if (!can(ctx.role, "menu:write")) throw new ForbiddenError("cannot write menu");
    const cat = await repo.updateCategory(ctx.tenantId, id, patch);
    await emit(events, "menu.category.updated", ctx.tenantId, cat);
    return cat;
  },

  async deleteCategory(id: string) {
    const ctx = getContext();
    if (!can(ctx.role, "menu:write")) throw new ForbiddenError("cannot write menu");
    // Deleting a category cascades to its items in Postgres — refuse unless
    // it is empty so a mis-tap cannot wipe half a menu.
    const items = await repo.listItems(ctx.tenantId, { categoryId: id });
    if (items.length > 0) {
      throw new ConflictError("move or delete this category's dishes first", {
        categoryId: id,
        items: items.length,
      });
    }
    await repo.deleteCategory(ctx.tenantId, id);
    await emit(events, "menu.category.deleted", ctx.tenantId, { id });
  },

  /**
   * Create or update one dish, matched on (categoryId, name). This is what
   * the admin menu import runs on — re-importing a corrected price must
   * update the dish, not shadow it with a second one at the new price.
   */
  async upsertItem(input: {
    categoryId: string;
    name: string;
    description?: string;
    basePrice: string;
    taxClass: string;
    isVeg: boolean;
  }): Promise<{ item: Item; created: boolean }> {
    const ctx = getContext();
    if (!can(ctx.role, "menu:write")) throw new ForbiddenError("cannot write menu");
    assertTaxClass(country(), input.taxClass);

    const existing = (await repo.listItems(ctx.tenantId, { categoryId: input.categoryId }))
      .find((i) => key(i.name) === key(input.name));

    if (!existing) return { item: await this.createItem(input), created: true };

    const item = await repo.updateItem(ctx.tenantId, existing.id, {
      name: input.name,
      description: input.description ?? null,
      basePrice: input.basePrice,
      taxClass: input.taxClass,
      isVeg: input.isVeg,
    });
    await emit(events, "menu.item.updated", ctx.tenantId, item);
    return { item, created: false };
  },
});

export type MenuService = ReturnType<typeof makeMenuService>;
