import { and, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import type { DB } from "@odr/db";
import { menuCategories, menuItems, outlets } from "@odr/db/schema";
import { NotFoundError } from "@odr/shared";
import type { MenuRepo } from "./ports.ts";

/**
 * Slim projection for every item read/return — the base64 photo stays out of
 * list JSON on purpose; the bytes are served by GET /public/menu-images/:id.
 */
const itemCols = {
  id: menuItems.id,
  outletId: menuItems.outletId,
  categoryId: menuItems.categoryId,
  name: menuItems.name,
  description: menuItems.description,
  basePrice: menuItems.basePrice,
  taxClass: menuItems.taxClass,
  isVeg: menuItems.isVeg,
  isActive: menuItems.isActive,
  sortOrder: menuItems.sortOrder,
  hasImage: sql<boolean>`(${menuItems.imageB64} is not null)`,
};

/** undefined = untouched; null or ItemImage = write the columns. */
const imagePatch = (image?: { data: string; type: string } | null) =>
  image === undefined
    ? {}
    : { imageB64: image?.data ?? null, imageType: image?.type ?? null };

export const drizzleMenuRepo = (db: DB): MenuRepo => ({
  async listCategories(tenantId, outletId) {
    // outletId provided: master (NULL) ∪ this outlet's overrides.
    // outletId omitted:  every row (admin/management view).
    const where: SQL = outletId
      ? and(eq(menuCategories.tenantId, tenantId), or(isNull(menuCategories.outletId), eq(menuCategories.outletId, outletId))!)!
      : eq(menuCategories.tenantId, tenantId);
    return db.select().from(menuCategories).where(where);
  },

  async createCategory(tenantId, input) {
    const [c] = await db
      .insert(menuCategories)
      .values({
        tenantId,
        outletId: input.outletId,
        name: input.name,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();
    if (!c) throw new Error("failed to insert category");
    return c;
  },

  async updateCategory(tenantId, id, patch) {
    const [c] = await db
      .update(menuCategories)
      .set(patch)
      .where(and(eq(menuCategories.tenantId, tenantId), eq(menuCategories.id, id)))
      .returning();
    if (!c) throw new NotFoundError("category", id);
    return c;
  },

  async deleteCategory(tenantId, id) {
    const rows = await db
      .delete(menuCategories)
      .where(and(eq(menuCategories.tenantId, tenantId), eq(menuCategories.id, id)))
      .returning({ id: menuCategories.id });
    if (!rows[0]) throw new NotFoundError("category", id);
  },

  async listItems(tenantId, { categoryId, outletId }) {
    const clauses: SQL[] = [eq(menuItems.tenantId, tenantId)];
    if (categoryId) clauses.push(eq(menuItems.categoryId, categoryId));
    if (outletId) clauses.push(or(isNull(menuItems.outletId), eq(menuItems.outletId, outletId))!);
    return db.select(itemCols).from(menuItems).where(and(...clauses)!);
  },

  async createItem(tenantId, input) {
    // Validate the parent category belongs to this tenant. (Outlet validation
    // happens in the service against the outlets table.)
    const cat = await db
      .select({ id: menuCategories.id })
      .from(menuCategories)
      .where(and(eq(menuCategories.tenantId, tenantId), eq(menuCategories.id, input.categoryId)))
      .limit(1);
    if (!cat[0]) throw new NotFoundError("category", input.categoryId);

    const [item] = await db
      .insert(menuItems)
      .values({
        tenantId,
        outletId: input.outletId,
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        basePrice: input.basePrice,
        taxClass: input.taxClass,
        isVeg: input.isVeg,
        ...imagePatch(input.image),
      })
      .returning(itemCols);
    if (!item) throw new Error("failed to insert item");
    return item;
  },

  async updateItem(tenantId, id, { image, ...patch }) {
    const [item] = await db
      .update(menuItems)
      .set({ ...patch, ...imagePatch(image) })
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)))
      .returning(itemCols);
    if (!item) throw new NotFoundError("item", id);
    return item;
  },

  async deleteItem(tenantId, id) {
    const rows = await db
      .delete(menuItems)
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)))
      .returning({ id: menuItems.id });
    if (!rows[0]) throw new NotFoundError("item", id);
  },

  async itemImage(id) {
    const [row] = await db
      .select({ data: menuItems.imageB64, type: menuItems.imageType })
      .from(menuItems)
      .where(eq(menuItems.id, id))
      .limit(1);
    return row?.data && row.type ? { data: row.data, type: row.type } : null;
  },

  async outletExistsInTenant(tenantId, outletId) {
    const rows = await db
      .select({ id: outlets.id })
      .from(outlets)
      .where(and(eq(outlets.tenantId, tenantId), eq(outlets.id, outletId)))
      .limit(1);
    return rows.length > 0;
  },
});
