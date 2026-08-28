import { pgTable, uuid, text, timestamp, numeric, integer, index, date, jsonb } from "drizzle-orm/pg-core";

/** Owner-set look of their app: colors, font, logo, theme. NULL = Odr defaults. */
export interface Branding {
  primary: string;
  secondary: string;
  /** Optional heading/text accent. */
  tertiary?: string | null;
  /** Text on primary buttons; null = auto-picked from primary. */
  onPrimary?: string | null;
  font: string;
  theme: "light" | "dark" | "auto";
  style?: "classic" | "gradient" | "soft" | "sharp" | "glass";
  /** Small data-URL image. */
  logo?: string | null;
}

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  country: text("country").notNull().default("IN"),
  currency: text("currency").notNull().default("INR"),
  branding: jsonb("branding").$type<Branding>(),
  // Subscription window. NULL = no enforcement (existing demo tenants keep working).
  subscriptionStart: date("subscription_start"),
  subscriptionEnd: date("subscription_end"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Manually recorded payments. Each one extends tenants.subscription_end. */
export const topups = pgTable(
  "topups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    amountMinor: numeric("amount_minor", { precision: 20, scale: 0 }).notNull(),
    monthsAdded: integer("months_added").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("topups_tenant_idx").on(t.tenantId)],
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type Topup = typeof topups.$inferSelect;
