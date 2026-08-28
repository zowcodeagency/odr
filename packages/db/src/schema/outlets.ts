import { pgTable, uuid, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.ts";

export const outlets = pgTable("outlets", {
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Outlet = typeof outlets.$inferSelect;
export type NewOutlet = typeof outlets.$inferInsert;
