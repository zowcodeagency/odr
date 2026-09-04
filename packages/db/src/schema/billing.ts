import { pgTable, uuid, text, timestamp, integer, numeric, jsonb, index, uniqueIndex, foreignKey } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.ts";
import { outlets } from "./outlets.ts";

export const bills = pgTable(
  "bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").notNull(),
    invoiceNumber: text("invoice_number").notNull(),
    fiscalYear: text("fiscal_year").notNull(),
    currency: text("currency").notNull(),
    subtotalMinor: numeric("subtotal_minor", { precision: 20, scale: 0 }).notNull(),
    taxTotalMinor: numeric("tax_total_minor", { precision: 20, scale: 0 }).notNull(),
    grandTotalMinor: numeric("grand_total_minor", { precision: 20, scale: 0 }).notNull(),
    taxBreakdown: jsonb("tax_breakdown").$type<Array<{ name: string; rate: number; amountMinor: string }>>().notNull(),
    // Optional, asked for at settle. Snapshotted here rather than read back
    // through the order so the invoice stays a self-contained record.
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    settledAt: timestamp("settled_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bills_tenant_idx").on(t.tenantId),
    // The invoice list: WHERE tenant, outlet, settled_at >= … ORDER BY settled_at DESC.
    index("bills_outlet_settled_idx").on(t.tenantId, t.outletId, t.settledAt),
    index("bills_order_idx").on(t.orderId),
    uniqueIndex("bills_invoice_unique").on(t.outletId, t.fiscalYear, t.invoiceNumber),
    foreignKey({ columns: [t.outletId, t.tenantId], foreignColumns: [outlets.id, outlets.tenantId], name: "bills_outlet_tenant_fk" }),
  ],
);

export const billLines = pgTable(
  "bill_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    billId: uuid("bill_id").notNull().references(() => bills.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull(),
    itemName: text("item_name").notNull(),
    qty: integer("qty").notNull(),
    unitPriceMinor: numeric("unit_price_minor", { precision: 20, scale: 0 }).notNull(),
    taxClass: text("tax_class").notNull(),
    lineSubtotalMinor: numeric("line_subtotal_minor", { precision: 20, scale: 0 }).notNull(),
    lineTaxMinor: numeric("line_tax_minor", { precision: 20, scale: 0 }).notNull(),
  },
  (t) => [index("bill_lines_bill_idx").on(t.billId)],
);

export type Bill = typeof bills.$inferSelect;
export type BillLine = typeof billLines.$inferSelect;
