import { and, eq } from "drizzle-orm";
import { subscriptionEndOf, type DB } from "@odr/db";
import { users, memberships, tenants } from "@odr/db/schema";
import type { IdentityRepo } from "./ports.ts";

export const drizzleIdentityRepo = (db: DB): IdentityRepo => ({
  async findUserByEmail(email) {
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const u = rows[0];
    if (!u) return null;
    return { id: u.id, email: u.email, fullName: u.fullName, passwordHash: u.passwordHash };
  },

  async createUser({ email, passwordHash, fullName }) {
    const [u] = await db.insert(users).values({ email, passwordHash, fullName }).returning();
    if (!u) throw new Error("failed to insert user");
    return { id: u.id, email: u.email, fullName: u.fullName };
  },

  async listMemberships(userId) {
    const rows = await db
      .select({ tenantId: memberships.tenantId, userId: memberships.userId, role: memberships.role, tenantName: tenants.name })
      .from(memberships)
      .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
      .where(eq(memberships.userId, userId));
    return rows;
  },

  subscriptionEnd: subscriptionEndOf,

  async listStaff(tenantId) {
    const rows = await db
      .select({ id: users.id, email: users.email, fullName: users.fullName, role: memberships.role })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.tenantId, tenantId))
      .orderBy(users.fullName);
    return rows;
  },

  async addMembership(tenantId, userId, role) {
    await db
      .insert(memberships)
      .values({ tenantId, userId, role })
      .onConflictDoUpdate({ target: [memberships.tenantId, memberships.userId], set: { role } });
  },

  async removeMembership(tenantId, userId) {
    await db
      .delete(memberships)
      .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)));
  },
});
