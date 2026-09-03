import { pgTable, uuid, text, timestamp, integer, numeric, jsonb, index, uniqueIndex, foreignKey } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.ts";
import { outlets } from "./outlets.ts";

/** Physical tables an outlet can seat. Labels are what waiters and QR codes use. */
export const tables = pgTable(
  "tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tables_outlet_label_unique").on(t.outletId, t.label),
    foreignKey({ columns: [t.outletId, t.tenantId], foreignColumns: [outlets.id, outlets.tenantId], name: "tables_outlet_tenant_fk" }),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "restrict" }),
    // NULL for off-table channels (parcel / aggregators / counter).
    tableLabel: text("table_label"),
    state: text("state").notNull(),
    channel: text("channel").notNull().default("dine_in"),
    customerName: text("customer_name"),
    aggregatorRef: text("aggregator_ref"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    kotFiredAt: timestamp("kot_fired_at", { withTimezone: true }),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (t) => [
    index("orders_open_idx").on(t.outletId, t.state),
    foreignKey({ columns: [t.outletId, t.tenantId], foreignColumns: [outlets.id, outlets.tenantId], name: "orders_outlet_tenant_fk" }),
  ],
);

export const orderLines = pgTable(
  "order_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    kotId: uuid("kot_id"),
    itemId: uuid("item_id").notNull(),
    itemName: text("item_name").notNull(),
    qty: integer("qty").notNull(),
    unitPriceMinor: numeric("unit_price_minor", { precision: 20, scale: 0 }).notNull(),
    taxClass: text("tax_class").notNull(),
    note: text("note"),
    modifiers: jsonb("modifiers")
      .$type<Array<{ id: string; name: string; priceDeltaMinor: string }>>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_lines_order_idx").on(t.orderId), index("order_lines_kot_idx").on(t.kotId)],
);

/** One kitchen ticket per fire. Lines point back at it via order_lines.kot_id. */
export const kots = pgTable(
  "kots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    firedAt: timestamp("fired_at", { withTimezone: true }).notNull().defaultNow(),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [
    index("kots_pending_idx").on(t.outletId, t.doneAt),
    foreignKey({ columns: [t.outletId, t.tenantId], foreignColumns: [outlets.id, outlets.tenantId], name: "kots_outlet_tenant_fk" }),
  ],
);

export type TableRow = typeof tables.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type OrderLineRow = typeof orderLines.$inferSelect;
export type KotRow = typeof kots.$inferSelect;
