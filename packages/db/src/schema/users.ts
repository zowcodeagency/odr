import { pgTable, uuid, text, timestamp, primaryKey, foreignKey } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.ts";
import { outlets } from "./outlets.ts";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "manager", "captain", "cashier", "kitchen"] }).notNull(),
    // NULL = every outlet (owner / manager). Captains, cashiers and kitchen are pinned to one.
    outletId: uuid("outlet_id").references(() => outlets.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.userId] }),
    foreignKey({ columns: [t.outletId, t.tenantId], foreignColumns: [outlets.id, outlets.tenantId], name: "memberships_outlet_tenant_fk" }),
  ],
);

export type User = typeof users.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
