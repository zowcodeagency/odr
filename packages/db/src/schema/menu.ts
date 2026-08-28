import { pgTable, uuid, text, timestamp, integer, boolean, numeric, index } from "drizzle-orm/pg-core";
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
  (t) => [index("menu_categories_tenant_idx").on(t.tenantId)],
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
  (t) => [index("menu_items_tenant_idx").on(t.tenantId), index("menu_items_category_idx").on(t.categoryId)],
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

export type MenuCategory = typeof menuCategories.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type MenuModifierGroup = typeof menuModifierGroups.$inferSelect;
export type MenuModifier = typeof menuModifiers.$inferSelect;
