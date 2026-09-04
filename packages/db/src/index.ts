import { AsyncLocalStorage } from "node:async_hooks";
import { and, eq } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.ts";
import { tenants } from "./schema/tenants.ts";
import { memberships } from "./schema/users.ts";

export type DB = PostgresJsDatabase<typeof schema>;

// Supabase's transaction pooler multiplexes connections per transaction and
// rejects prepared statements (error 42P05), hence prepare: false everywhere.
const client = (url: string) => drizzle(postgres(url, { prepare: false, max: 5 }), { schema });

// Cloudflare Workers forbid reusing a connection across requests ("Cannot
// perform I/O on behalf of a different request"), so the Worker entry wraps
// each request in withRequestDb and the `db` proxy resolves through ALS.
// On Bun (dev / a long-lived host) the store is empty and one lazily-created
// process-wide client is used instead.
const als = new AsyncLocalStorage<DB>();
let _db: DB | undefined;
const real = (): DB => {
  const scoped = als.getStore();
  if (scoped) return scoped;
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  _db = client(url);
  return _db;
};

/** Run fn with a fresh request-scoped connection; closes it afterwards. */
export async function withRequestDb<T>(url: string, fn: () => Promise<T>): Promise<T> {
  const sql = postgres(url, { prepare: false, max: 5 });
  try {
    return await als.run(drizzle(sql, { schema }), fn);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export const db: DB = new Proxy({} as DB, {
  get(_, prop) {
    const v = Reflect.get(real() as object, prop);
    return typeof v === "function" ? v.bind(real()) : v;
  },
});
export * as schema from "./schema/index.ts";

/**
 * Subscription end date ('YYYY-MM-DD') for a tenant, or null when unset.
 * Lives here so both the auth middleware and the identity repo share one query.
 * ponytail: one extra SELECT per authenticated request — cache it if it shows up in latency.
 */
export async function subscriptionEndOf(tenantId: string): Promise<string | null> {
  return (await tenantGateOf(tenantId)).subscriptionEnd;
}

/** Everything the auth middleware needs from the tenant row, in one SELECT. */
export async function tenantGateOf(
  tenantId: string,
): Promise<{ subscriptionEnd: string | null; localBilling: boolean }> {
  const rows = await db
    .select({ subscriptionEnd: tenants.subscriptionEnd, localBilling: tenants.localBilling })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return rows[0] ?? { subscriptionEnd: null, localBilling: false };
}

/**
 * Live membership of a user in a tenant, or null when it is gone. Long-lived
 * tokens make this the revocation point: remove the staff row and the next
 * request 401s. outletId NULL = every outlet (owner / manager).
 */
export async function membershipOf(
  tenantId: string,
  userId: string,
): Promise<{ role: string; outletId: string | null } | null> {
  const rows = await db
    .select({ role: memberships.role, outletId: memberships.outletId })
    .from(memberships)
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function withTenant<T>(tenantId: string, fn: (tx: DB) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(`SET LOCAL app.tenant_id = '${tenantId.replace(/'/g, "''")}'`);
    return fn(tx as unknown as DB);
  });
}
