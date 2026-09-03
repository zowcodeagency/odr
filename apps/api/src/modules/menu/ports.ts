import type { MenuMode } from "@odr/db/schema";
import type { Category, Item, ItemImage } from "./domain.ts";

/** Rows as stored — `soldOutHere` is folded in by the service, so repos return items without it. */
export type ItemRow = Omit<Item, "soldOutHere">;

export interface MenuRepo {
  /**
   * outletId undefined → every row (admin view).
   * outletId + mode 'shared' → master (outletId null) ∪ that outlet's rows.
   * outletId + mode 'own'    → only that outlet's rows.
   */
  listCategories(tenantId: string, outletId?: string, mode?: MenuMode): Promise<Category[]>;
  createCategory(tenantId: string, input: { outletId?: string; name: string; sortOrder?: number }): Promise<Category>;
  updateCategory(tenantId: string, id: string, patch: { name?: string; sortOrder?: number }): Promise<Category>;
  /** Hard delete. The service refuses unless the category holds no items. */
  deleteCategory(tenantId: string, id: string): Promise<void>;

  listItems(tenantId: string, opts: { categoryId?: string; outletId?: string; mode?: MenuMode }): Promise<ItemRow[]>;
  createItem(tenantId: string, input: {
    outletId?: string;
    categoryId: string;
    name: string;
    description?: string;
    basePrice: string;
    taxClass: string;
    isVeg: boolean;
    image?: ItemImage | null;
  }): Promise<ItemRow>;
  updateItem(tenantId: string, id: string, patch: {
    name?: string;
    description?: string | null;
    basePrice?: string;
    taxClass?: string;
    isVeg?: boolean;
    isActive?: boolean;
    /** undefined = untouched, null = remove the photo. */
    image?: ItemImage | null;
  }): Promise<ItemRow>;
  /**
   * Hard delete. order_lines carries no FK to menu_items and snapshots the
   * name and price at the time of sale, so removing a dish cannot change or
   * corrupt any past order or bill.
   */
  deleteItem(tenantId: string, id: string): Promise<void>;

  /** Photo bytes for one item — tenant-free because dish photos are public content. */
  itemImage(id: string): Promise<ItemImage | null>;

  /** The outlet's menu mode, or null when the outlet is not in this tenant. */
  outletMenuMode(tenantId: string, outletId: string): Promise<MenuMode | null>;

  /** Ids of items 86'd at this outlet. */
  soldOutItemIds(tenantId: string, outletId: string): Promise<Set<string>>;
  /** Idempotent insert / delete of the presence row. */
  setSoldOut(tenantId: string, outletId: string, itemId: string, soldOut: boolean): Promise<void>;
}
