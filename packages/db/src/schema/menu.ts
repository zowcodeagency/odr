import { pgTable, uuid, text, timestamp, integer, boolean, numeric, index, primaryKey, foreignKey } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.ts";
import { outlets } from "./outlets.ts";

export const menuCategories = pgTable(
  "menu_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id").references(() => outlets.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("menu_categories_tenant_idx").on(t.tenantId),
    foreignKey({ columns: [t.outletId, t.tenantId], foreignColumns: [outlets.id, outlets.tenantId], name: "menu_categories_outlet_tenant_fk" }),
  ],
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    // outletId NULL = master item (visible to every outlet); UUID = outlet-specific override.
    // Same convention as menu_categories.outlet_id.
    outletId: uuid("outlet_id").references(() => outlets.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").notNull().references(() => menuCategories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull(),
    taxClass: text("tax_class").notNull().default("GST_5"),
    isVeg: boolean("is_veg").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    // ponytail: dish photo as base64 text — one code path for bun and
    // Workers (no filesystem, no R2 binding); move to R2 if menus grow heavy.
    imageB64: text("image_b64"),
    imageType: text("image_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("menu_items_tenant_idx").on(t.tenantId),
    index("menu_items_category_idx").on(t.categoryId),
    foreignKey({ columns: [t.outletId, t.tenantId], foreignColumns: [outlets.id, outlets.tenantId], name: "menu_items_outlet_tenant_fk" }),
  ],
);

export const menuModifierGroups = pgTable("menu_modifier_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  minSelect: integer("min_select").notNull().default(0),
  maxSelect: integer("max_select").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const menuModifiers = pgTable("menu_modifiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").notNull().references(() => menuModifierGroups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  priceDelta: numeric("price_delta", { precision: 12, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
});

/** Presence = "sold out at this outlet". menu_items.is_active stays the brand-wide switch. */
export const menuItemSoldout = pgTable(
  "menu_item_soldout",
  {
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.outletId, t.itemId] }),
    foreignKey({ columns: [t.outletId, t.tenantId], foreignColumns: [outlets.id, outlets.tenantId], name: "menu_item_soldout_outlet_tenant_fk" }),
  ],
);

export type MenuItemSoldout = typeof menuItemSoldout.$inferSelect;

export type MenuCategory = typeof menuCategories.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type MenuModifierGroup = typeof menuModifierGroups.$inferSelect;
export type MenuModifier = typeof menuModifiers.$inferSelect;
