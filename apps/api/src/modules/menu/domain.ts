// Convention (pattern A — master menu + per-outlet overrides):
//   outletId === null  → master, visible to every outlet in the tenant
//   outletId === UUID  → outlet-specific override, only that outlet sees it
// This applies to both Category and Item. Item.outletId is independent of its
// category's outletId — an outlet-specific item can sit under a master category.
export type Category = {
  id: string;
  outletId: string | null;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export type Item = {
  id: string;
  outletId: string | null;
  categoryId: string;
  name: string;
  description: string | null;
  basePrice: string;
  taxClass: string;
  isVeg: boolean;
  isActive: boolean;
  sortOrder: number;
  /** Derived flag — the bytes live behind GET /public/menu-images/:id, never in list JSON. */
  hasImage: boolean;
};

/** A dish photo travelling through the API: base64 bytes + mime type. */
export type ItemImage = { data: string; type: string };
