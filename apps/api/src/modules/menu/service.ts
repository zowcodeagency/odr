import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@odr/shared";
import { can } from "@odr/auth";
import { getTaxStrategy } from "@odr/tax";
import type { EventBus } from "@odr/events";
import type { MenuMode } from "@odr/db/schema";
import { assertOutletScope, getContext } from "@odr/tenancy";
import type { Item, ItemImage } from "./domain.ts";
import type { ItemRow, MenuRepo } from "./ports.ts";

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
    throw new ValidationError(`invalid tax class for ${tax.country}`, { taxClass, allowed: tax.classes() });
  }
};

/** Item as the apps read it: isActive already answers "orderable at this outlet?". */
const withSoldOut = (row: ItemRow, soldOut: Set<string>): Item => ({
  ...row,
  isActive: row.isActive && !soldOut.has(row.id),
  soldOutHere: soldOut.has(row.id),
});

export const makeMenuService = ({ repo, events, country }: MenuServiceDeps) => {
  /** Mode of an outlet in the caller's tenant, after the pin check. */
  const modeOf = async (outletId: string): Promise<MenuMode> => {
    assertOutletScope(outletId);
    const mode = await repo.outletMenuMode(getContext().tenantId, outletId);
    if (!mode) throw new NotFoundError("outlet", outletId);
    return mode;
  };

  /** Where a write from `outletId` lands: master row in shared mode, outlet row in own mode. */
  const storageOutlet = async (outletId?: string): Promise<string | undefined> =>
    outletId && (await modeOf(outletId)) === "own" ? outletId : undefined;

  const svc = {
    async listCategories(outletId?: string) {
      const tenantId = getContext().tenantId;
      if (!outletId) return repo.listCategories(tenantId);
      return repo.listCategories(tenantId, outletId, await modeOf(outletId));
    },

    async createCategory(input: { outletId?: string; name: string; sortOrder?: number }) {
      const ctx = getContext();
      if (!can(ctx.role, "menu:write")) throw new ForbiddenError("cannot write menu");
      const cat = await repo.createCategory(ctx.tenantId, { ...input, outletId: await storageOutlet(input.outletId) });
      await emit(events, "menu.category.created", ctx.tenantId, cat);
      return cat;
    },

    async listItems(opts: { categoryId?: string; outletId?: string }): Promise<Item[]> {
      const tenantId = getContext().tenantId;
      if (!opts.outletId) {
        return (await repo.listItems(tenantId, opts)).map((r) => withSoldOut(r, new Set()));
      }
      const mode = await modeOf(opts.outletId);
      const [rows, soldOut] = await Promise.all([
        repo.listItems(tenantId, { ...opts, mode }),
        repo.soldOutItemIds(tenantId, opts.outletId),
      ]);
      return rows.map((r) => withSoldOut(r, soldOut));
    },

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
    }): Promise<Item> {
      const ctx = getContext();
      if (!can(ctx.role, "menu:write")) throw new ForbiddenError("cannot write menu");
      assertTaxClass(country(), input.taxClass);
      const row = await repo.createItem(ctx.tenantId, { ...input, outletId: await storageOutlet(input.outletId) });
      await emit(events, "menu.item.created", ctx.tenantId, row);
      return withSoldOut(row, new Set());
    },

    async updateItem(id: string, patch: {
      name?: string;
      description?: string | null;
      basePrice?: string;
      taxClass?: string;
      isVeg?: boolean;
      isActive?: boolean;
      image?: ItemImage | null;
    }): Promise<Item> {
      const ctx = getContext();
      if (!can(ctx.role, "menu:write")) throw new ForbiddenError("cannot write menu");
      assertTaxClass(country(), patch.taxClass);
      const row = await repo.updateItem(ctx.tenantId, id, patch);
      await emit(events, "menu.item.updated", ctx.tenantId, row);
      return withSoldOut(row, new Set());
    },

    /**
     * The daily 86: sold out at this outlet only. Brand-wide isActive is untouched.
     * ponytail: full-list scan to find one item; add repo.itemById if menus pass ~500 dishes.
     */
    async setSoldOut(itemId: string, outletId: string, soldOut: boolean): Promise<Item> {
      const ctx = getContext();
      if (!can(ctx.role, "menu:write")) throw new ForbiddenError("cannot write menu");
      await modeOf(outletId); // scope + existence
      const item = (await repo.listItems(ctx.tenantId, {})).find((r) => r.id === itemId);
      if (!item) throw new NotFoundError("item", itemId);
      await repo.setSoldOut(ctx.tenantId, outletId, itemId, soldOut);
      await emit(events, "menu.item.soldout", ctx.tenantId, { itemId, outletId, soldOut });
      return withSoldOut(item, await repo.soldOutItemIds(ctx.tenantId, outletId));
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
        throw new ConflictError("move or delete this category's dishes first", { categoryId: id, items: items.length });
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
      outletId?: string;
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

      if (!existing) return { item: await svc.createItem(input), created: true };

      const row = await repo.updateItem(ctx.tenantId, existing.id, {
        name: input.name,
        description: input.description ?? null,
        basePrice: input.basePrice,
        taxClass: input.taxClass,
        isVeg: input.isVeg,
      });
      await emit(events, "menu.item.updated", ctx.tenantId, row);
      return { item: withSoldOut(row, new Set()), created: false };
    },
  };
  return svc;
};

export type MenuService = ReturnType<typeof makeMenuService>;
