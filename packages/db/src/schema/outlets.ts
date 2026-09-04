import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, unique } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.ts";

/** 'shared' = the brand's one menu (+ per-outlet sold-out). 'own' = this outlet's independent menu. */
export const MENU_MODES = ["shared", "own"] as const;
export type MenuMode = (typeof MENU_MODES)[number];

export const outlets = pgTable(
  "outlets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    gstin: text("gstin"),
    address: jsonb("address").$type<{
      line1: string;
      line2?: string;
      city: string;
      state: string;
      pincode: string;
      country: string;
    }>().notNull(),
    invoicePrefix: text("invoice_prefix").notNull().default("INV"),
    invoiceCounter: text("invoice_counter").notNull().default("0"),
    // Thermal printing. paperWidth is 58 or 80 (mm); printerIp NULL = no network
    // printer configured (browser print only). publicToken gates the QR diner app.
    paperWidth: integer("paper_width").notNull().default(80),
    printerIp: text("printer_ip"),
    printerPort: integer("printer_port").notNull().default(9100),
    publicToken: text("public_token"),
    // UPI ID (VPA) printed on the bill as a pay-this-amount QR. NULL = no QR.
    upiId: text("upi_id"),
    // Closed branches stay for their bills but disappear from pickers and refuse new orders.
    isActive: boolean("is_active").notNull().default(true),
    menuMode: text("menu_mode", { enum: MENU_MODES }).notNull().default("shared"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("outlets_tenant_code_unique").on(t.tenantId, t.code),
    // Target for the composite FKs below: (outlet_id, tenant_id) can never cross tenants.
    unique("outlets_id_tenant_unique").on(t.id, t.tenantId),
  ],
);

export type Outlet = typeof outlets.$inferSelect;
export type NewOutlet = typeof outlets.$inferInsert;
