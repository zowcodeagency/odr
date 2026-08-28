import type { Category, Item, ItemImage } from "./domain.ts";

export interface MenuRepo {
  /**
   * List categories visible to outletId — returns master categories (outletId === null)
   * UNION outlet-specific overrides for that outlet. Pass undefined to list all
   * (master + every outlet) for management/admin views.
   */
  listCategories(tenantId: string, outletId?: string): Promise<Category[]>;
  createCategory(tenantId: string, input: {
    outletId?: string;
    name: string;
    sortOrder?: number;
  }): Promise<Category>;

  updateCategory(tenantId: string, id: string, patch: { name?: string; sortOrder?: number }): Promise<Category>;
  /** Hard delete. The service refuses unless the category holds no items. */
  deleteCategory(tenantId: string, id: string): Promise<void>;

  listItems(tenantId: string, opts: { categoryId?: string; outletId?: string }): Promise<Item[]>;
  createItem(tenantId: string, input: {
    outletId?: string;
    categoryId: string;
    name: string;
    description?: string;
    basePrice: string;
    taxClass: string;
    isVeg: boolean;
    image?: ItemImage | null;
  }): Promise<Item>;

  updateItem(tenantId: string, id: string, patch: {
    name?: string;
    description?: string | null;
    basePrice?: string;
    taxClass?: string;
    isVeg?: boolean;
    isActive?: boolean;
    /** undefined = untouched, null = remove the photo. */
    image?: ItemImage | null;
  }): Promise<Item>;
  /**
   * Hard delete. order_lines carries no FK to menu_items and snapshots the
   * name and price at the time of sale, so removing a dish cannot change or
   * corrupt any past order or bill.
   */
  deleteItem(tenantId: string, id: string): Promise<void>;

  /** Photo bytes for one item — tenant-free because dish photos are public content. */
  itemImage(id: string): Promise<ItemImage | null>;

  /** Returns true if outletId belongs to tenantId. Used to guard menu writes against cross-tenant ids. */
  outletExistsInTenant(tenantId: string, outletId: string): Promise<boolean>;
}
