# Multi-outlet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one restaurant brand run several outlets on Odr: owners/managers switch outlets, floor staff are pinned to one, the brand shares one menu (or gives an outlet its own), sales roll up, and the Odr team adds outlets from the admin console.

**Architecture:** The DB is already `tenant → outlets`. We add a nullable `outlet_id` on memberships (NULL = every outlet), a `menu_mode` per outlet, a `menu_item_soldout` presence table, and composite FKs so an outlet id can never cross tenants. The API keeps its shape — every call already carries an `outletId` — and gains one pure guard (`assertOutletScope`) that pinned staff cannot pass for another outlet. The captain PWA picks an outlet after login, remembers it, and can switch from the topbar.

**Tech Stack:** Bun workspaces, Hono, Drizzle ORM (Postgres), zod, React 19 CSR PWA (hash router, Tailwind 4, `@odr/ui` Radix primitives), `bun test`.

**Spec:** `docs/superpowers/specs/2026-09-03-multi-outlet-design.md`

## Global Constraints

- Roles: `owner | manager | captain | cashier | kitchen`. Only `owner` and `manager` may have a NULL membership outlet.
- `menu_mode` values: `'shared' | 'own'`, default `'shared'`.
- Money stays bigint/string minor units; never floats.
- Error classes come from `@odr/shared`: `ForbiddenError`, `NotFoundError`, `ValidationError`, `ConflictError`.
- Every service reads the caller from `getContext()` (`@odr/tenancy`); repos take `tenantId` explicitly.
- Tests: `bun test` from the repo root; module tests use fake repos (see `apps/api/src/modules/outlets/outlets.test.ts` for the style). Typecheck: `bun run typecheck`.
- Commit messages: conventional (`feat:`, `fix:`, `test:`, `docs:`), end with the two attribution lines below.

```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01G4bHXPhvpXEiPzEeGA3JPt
```

## File map

| File | Responsibility |
|---|---|
| `packages/db/src/schema/outlets.ts` | `is_active`, `menu_mode`, uniques, `MenuMode` type |
| `packages/db/src/schema/users.ts` | `memberships.outlet_id` + composite FK |
| `packages/db/src/schema/menu.ts` | composite FKs, `menu_item_soldout` table |
| `packages/db/src/schema/ordering.ts`, `billing.ts` | composite FKs |
| `packages/db/src/index.ts` | `membershipOf` replaces `membershipRoleOf` |
| `packages/db/drizzle/0008_*.sql` | generated migration + membership backfill |
| `packages/tenancy/src/index.ts` (+ `index.test.ts`) | `assertOutletScope` |
| `apps/api/src/middleware/auth.ts` | put membership outlet into context |
| `apps/api/src/modules/outlets/*` | `isActive`, `menuMode`, scoped list, extended PATCH, `activeInTenant` |
| `apps/api/src/modules/menu/*` | mode-aware reads/writes, per-outlet sold-out |
| `apps/api/src/modules/ordering/service.ts`, `routes.ts` | scope guard, inactive-outlet refusal |
| `apps/api/src/modules/billing/*` | optional outlet on list, scope guard |
| `apps/api/src/modules/printing/service.ts` | scope guard on test print |
| `apps/api/src/modules/identity/*` | staff outlet |
| `apps/api/src/modules/admin/*` | outlets list/create/patch, outlet count, import target |
| `apps/api/src/app.ts` | wire ordering's `outletActive` |
| `apps/captain-pwa/src/lib/session.ts` (+ test) | `outlets`, `menuMode`, `pickOutlet`, `outletPatch`, session event |
| `apps/captain-pwa/src/lib/api.ts` | new types/endpoints |
| `apps/captain-pwa/src/routes/login.tsx` | outlet picker step |
| `apps/captain-pwa/src/shell/outlet-switcher.tsx` (new), `topbar.tsx`, `app-shell.tsx`, `app.tsx` | switcher |
| `apps/captain-pwa/src/routes/settings.tsx` | Outlet tab, staff outlet select |
| `apps/captain-pwa/src/routes/menu.tsx` | per-outlet sold-out |
| `apps/captain-pwa/src/routes/bills.tsx` | This outlet / All outlets |
| `apps/admin/src/api.ts`, `drawer.tsx`, `app.tsx` | outlets section, count column, import target |

---

### Task 1: Schema and migration

**Files:**
- Modify: `packages/db/src/schema/outlets.ts`
- Modify: `packages/db/src/schema/users.ts`
- Modify: `packages/db/src/schema/menu.ts`
- Modify: `packages/db/src/schema/ordering.ts`
- Modify: `packages/db/src/schema/billing.ts`
- Modify: `packages/db/src/index.ts`
- Create: `packages/db/drizzle/0008_<generated-name>.sql` (generated, then appended)

**Interfaces:**
- Produces: `MenuMode = "shared" | "own"`, `MENU_MODES`, `menuItemSoldout` table, `memberships.outletId`, `outlets.isActive`, `outlets.menuMode`, `membershipOf(tenantId, userId): Promise<{ role: string; outletId: string | null } | null>`.

- [ ] **Step 1: Outlets schema**

Replace `packages/db/src/schema/outlets.ts` with:

```ts
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
```

- [ ] **Step 2: Memberships gain an outlet**

Replace `packages/db/src/schema/users.ts` with:

```ts
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
```

- [ ] **Step 3: Menu schema — composite FKs and the sold-out table**

In `packages/db/src/schema/menu.ts` change the import line to:

```ts
import { pgTable, uuid, text, timestamp, integer, boolean, numeric, index, primaryKey, foreignKey } from "drizzle-orm/pg-core";
```

Change the `menuCategories` extra-config array to:

```ts
  (t) => [
    index("menu_categories_tenant_idx").on(t.tenantId),
    foreignKey({ columns: [t.outletId, t.tenantId], foreignColumns: [outlets.id, outlets.tenantId], name: "menu_categories_outlet_tenant_fk" }),
  ],
```

Change the `menuItems` extra-config array to:

```ts
  (t) => [
    index("menu_items_tenant_idx").on(t.tenantId),
    index("menu_items_category_idx").on(t.categoryId),
    foreignKey({ columns: [t.outletId, t.tenantId], foreignColumns: [outlets.id, outlets.tenantId], name: "menu_items_outlet_tenant_fk" }),
  ],
```

Append after `menuModifiers`:

```ts
/** Presence = "sold out at this outlet". menu_items.is_active stays the brand-wide switch. */
export const menuItemSoldout = pgTable(
  "menu_item_soldout",
  {
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.outletId, t.itemId] })],
);

export type MenuItemSoldout = typeof menuItemSoldout.$inferSelect;
```

- [ ] **Step 4: Ordering and billing composite FKs**

In `packages/db/src/schema/ordering.ts` add `foreignKey` to the drizzle import and extend the three extra-config arrays:

```ts
// tables
  (t) => [
    uniqueIndex("tables_outlet_label_unique").on(t.outletId, t.label),
    foreignKey({ columns: [t.outletId, t.tenantId], foreignColumns: [outlets.id, outlets.tenantId], name: "tables_outlet_tenant_fk" }),
  ],
// orders
  (t) => [
    index("orders_open_idx").on(t.outletId, t.state),
    foreignKey({ columns: [t.outletId, t.tenantId], foreignColumns: [outlets.id, outlets.tenantId], name: "orders_outlet_tenant_fk" }),
  ],
// kots
  (t) => [
    index("kots_pending_idx").on(t.outletId, t.doneAt),
    foreignKey({ columns: [t.outletId, t.tenantId], foreignColumns: [outlets.id, outlets.tenantId], name: "kots_outlet_tenant_fk" }),
  ],
```

In `packages/db/src/schema/billing.ts` add `foreignKey` to the import and extend the `bills` array:

```ts
  (t) => [
    index("bills_tenant_idx").on(t.tenantId),
    index("bills_order_idx").on(t.orderId),
    uniqueIndex("bills_invoice_unique").on(t.outletId, t.fiscalYear, t.invoiceNumber),
    foreignKey({ columns: [t.outletId, t.tenantId], foreignColumns: [outlets.id, outlets.tenantId], name: "bills_outlet_tenant_fk" }),
  ],
```

- [ ] **Step 5: `membershipOf` replaces `membershipRoleOf`**

In `packages/db/src/index.ts` replace the `membershipRoleOf` function with:

```ts
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
```

Then update the only caller, `apps/api/src/middleware/auth.ts`: change the import to `membershipOf` and the body to

```ts
  const m = await membershipOf(claims.tid, claims.sub);
  if (!m) throw new UnauthorizedError("membership revoked");
  const role = m.role;
```

and pass `outletId: m.outletId ?? undefined` inside the `runWithContext` object (Task 2 finishes the middleware).

- [ ] **Step 6: Generate the migration and append the backfill**

Run: `bun run db:generate`
Expected: a new file `packages/db/drizzle/0008_*.sql` containing `ALTER TABLE "memberships" ADD COLUMN "outlet_id" uuid;`, `ALTER TABLE "outlets" ADD COLUMN "is_active" …`, `ALTER TABLE "outlets" ADD COLUMN "menu_mode" …`, `CREATE TABLE "menu_item_soldout"`, the `*_outlet_tenant_fk` constraints and both `outlets_*_unique` constraints.

Append to the end of that file (keep the statement-breakpoint marker):

```sql
--> statement-breakpoint
UPDATE "memberships" m
SET "outlet_id" = (
  SELECT o."id" FROM "outlets" o
  WHERE o."tenant_id" = m."tenant_id"
  ORDER BY o."created_at" ASC
  LIMIT 1
)
WHERE m."role" NOT IN ('owner', 'manager') AND m."outlet_id" IS NULL;
```

- [ ] **Step 7: Typecheck and apply**

Run: `bun run typecheck`
Expected: PASS (the only errors allowed are in `apps/api/src/middleware/auth.ts` if Task 2 is not done yet — fix them there).

Run: `bun run db:migrate` (uses `DATABASE_URL` from `.env`; skip if no database is reachable and say so in the commit body).
Expected: `migrations applied`.

- [ ] **Step 8: Commit**

```bash
git add packages/db apps/api/src/middleware/auth.ts
git commit -m "feat(db): outlet-scoped memberships, menu_mode, per-outlet sold-out, composite outlet FKs"
```

---

### Task 2: Outlet scope guard in tenancy + auth middleware

**Files:**
- Modify: `packages/tenancy/src/index.ts`
- Create: `packages/tenancy/src/index.test.ts`
- Modify: `apps/api/src/middleware/auth.ts`

**Interfaces:**
- Produces: `assertOutletScope(outletId: string): void` — throws `ForbiddenError("outlet out of scope")` when `getContext().outletId` is set and differs. `RequestContext.outletId` now means "pinned outlet" (undefined = every outlet).

- [ ] **Step 1: Failing test**

Create `packages/tenancy/src/index.test.ts`:

```ts
import { test, expect } from "bun:test";
import { asTenantId, asUserId } from "@odr/shared";
import { assertOutletScope, runWithContext } from "./index.ts";

const base = { tenantId: asTenantId("t-1"), userId: asUserId("u-1"), role: "captain" as const };
const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

test("unpinned staff pass for any outlet", () => {
  runWithContext({ ...base, role: "owner" }, () => {
    expect(() => assertOutletScope(A)).not.toThrow();
    expect(() => assertOutletScope(B)).not.toThrow();
  });
});

test("pinned staff pass only for their own outlet", () => {
  runWithContext({ ...base, outletId: A }, () => {
    expect(() => assertOutletScope(A)).not.toThrow();
    expect(() => assertOutletScope(B)).toThrow(/out of scope/);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `bun test packages/tenancy`
Expected: FAIL — `assertOutletScope` is not exported.

- [ ] **Step 3: Implement**

Append to `packages/tenancy/src/index.ts`:

```ts
import { ForbiddenError } from "@odr/shared";

/**
 * Pinned staff (membership.outlet_id set) may only touch that outlet.
 * Owners and managers carry no outletId in context and pass for every outlet.
 */
export const assertOutletScope = (outletId: string): void => {
  const pinned = getContext().outletId;
  if (pinned && pinned !== outletId) throw new ForbiddenError("outlet out of scope");
};
```

Move that `import` to the top of the file with the others, and change the `RequestContext.outletId` comment:

```ts
export type RequestContext = {
  tenantId: TenantId;
  userId: UserId;
  role: "owner" | "manager" | "captain" | "cashier" | "kitchen";
  /** Membership pin. undefined = every outlet in the tenant (owner / manager). */
  outletId?: string;
};
```

- [ ] **Step 4: Middleware passes the pin**

`apps/api/src/middleware/auth.ts` final form:

```ts
import type { MiddlewareHandler } from "hono";
import { verifyAccessToken } from "@odr/auth";
import { membershipOf, subscriptionEndOf } from "@odr/db";
import { DomainError, UnauthorizedError, asTenantId, asUserId } from "@odr/shared";
import { runWithContext } from "@odr/tenancy";
import { isExpired } from "../modules/admin/domain.ts";

const secret = process.env.JWT_SECRET ?? "dev-only-change-me";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) throw new UnauthorizedError("missing bearer token");
  const token = header.slice("Bearer ".length);

  const claims = await verifyAccessToken(token, secret).catch(() => {
    throw new UnauthorizedError("invalid token");
  });

  // Tokens live 30 days, so the membership row is the source of truth:
  // removed staff 401 on their next request, role and outlet changes apply immediately.
  const m = await membershipOf(claims.tid, claims.sub);
  if (!m) throw new UnauthorizedError("membership revoked");

  // Subscription gate — null end date means the tenant isn't enforced.
  if (isExpired(await subscriptionEndOf(claims.tid))) {
    throw new DomainError("SUBSCRIPTION_EXPIRED", "subscription expired");
  }

  return runWithContext(
    {
      tenantId: asTenantId(claims.tid),
      userId: asUserId(claims.sub),
      role: m.role as typeof claims.role,
      ...(m.outletId ? { outletId: m.outletId } : {}),
    },
    () => next(),
  );
};
```

- [ ] **Step 5: Run tests and typecheck**

Run: `bun test packages/tenancy && bun run typecheck`
Expected: 2 pass, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add packages/tenancy apps/api/src/middleware/auth.ts
git commit -m "feat(api): pinned-outlet scope guard from membership"
```

---

### Task 3: Outlets module — active flag, menu mode, scoped list, richer PATCH

**Files:**
- Modify: `apps/api/src/modules/outlets/domain.ts`
- Modify: `apps/api/src/modules/outlets/ports.ts`
- Modify: `apps/api/src/modules/outlets/repo.drizzle.ts`
- Modify: `apps/api/src/modules/outlets/service.ts`
- Modify: `apps/api/src/modules/outlets/routes.ts`
- Modify: `apps/api/src/modules/outlets/outlets.test.ts`

**Interfaces:**
- Consumes: `assertOutletScope`, `MenuMode` from `@odr/db/schema`.
- Produces: `Outlet` gains `isActive: boolean; menuMode: MenuMode`. `OutletSettings` gains `name?`, `gstin?: string | null`, `address?`, `invoicePrefix?`. Service gains `activeInTenant(tenantId, outletId): Promise<boolean>`. `list()` returns only accessible outlets, active first then by name.

- [ ] **Step 1: Failing tests**

Replace the `fakeRepo` in `outlets.test.ts` and add tests:

```ts
import { test, expect } from "bun:test";
import { InMemoryEventBus } from "@odr/events";
import { runWithContext } from "@odr/tenancy";
import { asTenantId, asUserId } from "@odr/shared";
import { makeOutletsService } from "./service.ts";
import type { OutletsRepo } from "./ports.ts";
import type { Outlet } from "./domain.ts";

const ctx = {
  tenantId: asTenantId("11111111-1111-1111-1111-111111111111"),
  userId: asUserId("22222222-2222-2222-2222-222222222222"),
  role: "owner" as const,
};
const OUTLET = "33333333-3333-3333-3333-333333333333";
const OTHER = "44444444-4444-4444-4444-444444444444";

const outlet = (id: string, over: Partial<Outlet> = {}): Outlet => ({
  id,
  name: id === OUTLET ? "Central" : "Airport",
  code: id.slice(0, 4),
  gstin: null,
  address: { line1: "-", city: "-", state: "-", pincode: "-", country: "IN" },
  invoicePrefix: "INV",
  paperWidth: 80,
  printerIp: null,
  printerPort: 9100,
  publicToken: null,
  isActive: true,
  menuMode: "shared",
  ...over,
});

// Mirrors the repo's `coalesce(public_token, $candidate)` get-or-create.
const fakeRepo = (rows: Outlet[] = [outlet(OUTLET), outlet(OTHER)]): OutletsRepo => {
  let token: string | null = null;
  return {
    list: async () => rows,
    byId: async (_t, id) => rows.find((o) => o.id === id) ?? null,
    create: async () => { throw new Error("unused"); },
    updateSettings: async (_t, id, s) => {
      const o = rows.find((x) => x.id === id);
      return o ? Object.assign(o, s) : null;
    },
    async ensurePublicToken(_t, _o, candidate) { token ??= candidate; return token; },
    listTables: async () => [],
    addTables: async () => [],
    deleteTable: async () => true,
  };
};

test("qr-token is get-or-create: printed QR codes keep working", async () => {
  const svc = makeOutletsService({ repo: fakeRepo(), events: new InMemoryEventBus() });
  await runWithContext(ctx, async () => {
    const first = await svc.ensurePublicToken(OUTLET);
    expect(first).toHaveLength(32);
    expect(await svc.ensurePublicToken(OUTLET)).toBe(first);
  });
});

test("paperWidth only accepts 58 or 80", async () => {
  const svc = makeOutletsService({ repo: fakeRepo(), events: new InMemoryEventBus() });
  await runWithContext(ctx, async () => {
    await expect(svc.updateSettings(OUTLET, { paperWidth: 72 })).rejects.toThrow(/58 or 80/);
  });
});

test("owners see every outlet, active first; pinned staff see only theirs", async () => {
  const rows = [outlet(OUTLET, { isActive: false }), outlet(OTHER)];
  const svc = makeOutletsService({ repo: fakeRepo(rows), events: new InMemoryEventBus() });
  await runWithContext(ctx, async () => {
    expect((await svc.list()).map((o) => o.id)).toEqual([OTHER, OUTLET]);
  });
  await runWithContext({ ...ctx, role: "captain", outletId: OUTLET }, async () => {
    expect((await svc.list()).map((o) => o.id)).toEqual([OUTLET]);
    await expect(svc.listTables(OTHER)).rejects.toThrow(/out of scope/);
  });
});

test("owner can rename an outlet and fix its GSTIN; a bad GSTIN is rejected", async () => {
  const svc = makeOutletsService({ repo: fakeRepo(), events: new InMemoryEventBus() });
  await runWithContext(ctx, async () => {
    const o = await svc.updateSettings(OUTLET, { name: "Central Kitchen", gstin: "29ABCDE1234F1Z5" });
    expect(o.name).toBe("Central Kitchen");
    await expect(svc.updateSettings(OUTLET, { gstin: "nope" })).rejects.toThrow(/GSTIN/);
  });
});

test("activeInTenant answers without a request context", async () => {
  const svc = makeOutletsService({ repo: fakeRepo([outlet(OUTLET, { isActive: false })]), events: new InMemoryEventBus() });
  expect(await svc.activeInTenant(ctx.tenantId, OUTLET)).toBe(false);
  expect(await svc.activeInTenant(ctx.tenantId, OTHER)).toBe(false);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `bun test apps/api/src/modules/outlets`
Expected: FAIL — type errors on `isActive`/`menuMode`, missing `activeInTenant`, list order.

- [ ] **Step 3: Domain**

In `domain.ts` add the import and change the types:

```ts
import type { MenuMode } from "@odr/db/schema";

export type Outlet = {
  id: string;
  name: string;
  code: string;
  gstin: string | null;
  address: Address;
  invoicePrefix: string;
  paperWidth: number;
  printerIp: string | null;
  printerPort: number;
  publicToken: string | null;
  isActive: boolean;
  menuMode: MenuMode;
};

/** Everything the owner may change from the app. Printing plus the outlet's identity. */
export type OutletSettings = {
  paperWidth?: number;
  printerIp?: string | null;
  printerPort?: number;
  name?: string;
  gstin?: string | null;
  address?: Address;
  invoicePrefix?: string;
};
```

- [ ] **Step 4: Repo**

In `repo.drizzle.ts`: extend `toDomain` with `isActive: r.isActive, menuMode: r.menuMode,` and make `updateSettings` write all fields:

```ts
  async updateSettings(tenantId, outletId, settings) {
    const [row] = await db
      .update(outlets)
      .set({
        ...(settings.paperWidth !== undefined ? { paperWidth: settings.paperWidth } : {}),
        ...(settings.printerIp !== undefined ? { printerIp: settings.printerIp } : {}),
        ...(settings.printerPort !== undefined ? { printerPort: settings.printerPort } : {}),
        ...(settings.name !== undefined ? { name: settings.name } : {}),
        ...(settings.gstin !== undefined ? { gstin: settings.gstin } : {}),
        ...(settings.address !== undefined ? { address: settings.address } : {}),
        ...(settings.invoicePrefix !== undefined ? { invoicePrefix: settings.invoicePrefix } : {}),
      })
      .where(and(eq(outlets.tenantId, tenantId), eq(outlets.id, outletId)))
      .returning();
    return row ? toDomain(row) : null;
  },
```

- [ ] **Step 5: Service**

Replace `service.ts` with:

```ts
import { randomBytes } from "node:crypto";
import { ForbiddenError, NotFoundError, ValidationError } from "@odr/shared";
import { can } from "@odr/auth";
import type { EventBus } from "@odr/events";
import { assertOutletScope, getContext } from "@odr/tenancy";
import { isValidGstin, isValidPaperWidth, type Address, type Outlet, type OutletSettings } from "./domain.ts";
import type { OutletsRepo } from "./ports.ts";

export type OutletsServiceDeps = { repo: OutletsRepo; events: EventBus };

/** Active outlets first, then by name — the order every picker shows. */
const pickerOrder = (a: Outlet, b: Outlet) =>
  Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name);

export const makeOutletsService = ({ repo, events }: OutletsServiceDeps) => ({
  /** Only what the caller may use: pinned staff get exactly their outlet. */
  async list() {
    const ctx = getContext();
    const rows = await repo.list(ctx.tenantId);
    return rows.filter((o) => !ctx.outletId || o.id === ctx.outletId).sort(pickerOrder);
  },

  byId(outletId: string) {
    assertOutletScope(outletId);
    return repo.byId(getContext().tenantId, outletId);
  },

  /** Context-free: ordering asks before opening an order, billing events run as system. */
  activeInTenant: async (tenantId: string, outletId: string) =>
    (await repo.byId(tenantId, outletId))?.isActive ?? false,

  async create(input: { name: string; code: string; gstin?: string; address: Address; invoicePrefix?: string }) {
    const ctx = getContext();
    if (!can(ctx.role, "outlet:write")) throw new ForbiddenError("cannot write outlets");
    if (input.gstin && !isValidGstin(input.gstin)) {
      throw new ValidationError("invalid GSTIN", { gstin: input.gstin });
    }
    const outlet = await repo.create(ctx.tenantId, input);
    await events.publish({
      name: "outlet.created",
      tenantId: ctx.tenantId,
      occurredAt: new Date().toISOString(),
      payload: outlet,
    });
    return outlet;
  },

  async updateSettings(outletId: string, settings: OutletSettings) {
    const ctx = getContext();
    if (!can(ctx.role, "outlet:write")) throw new ForbiddenError("cannot write outlets");
    assertOutletScope(outletId);
    if (settings.paperWidth !== undefined && !isValidPaperWidth(settings.paperWidth)) {
      throw new ValidationError("paperWidth must be 58 or 80", { paperWidth: settings.paperWidth });
    }
    if (settings.gstin && !isValidGstin(settings.gstin)) {
      throw new ValidationError("invalid GSTIN", { gstin: settings.gstin });
    }
    const outlet = await repo.updateSettings(ctx.tenantId, outletId, settings);
    if (!outlet) throw new NotFoundError("outlet", outletId);
    return outlet;
  },

  /** Idempotent: the QR codes already printed keep working. */
  async ensurePublicToken(outletId: string) {
    const ctx = getContext();
    if (!can(ctx.role, "outlet:write")) throw new ForbiddenError("cannot write outlets");
    assertOutletScope(outletId);
    const token = await repo.ensurePublicToken(ctx.tenantId, outletId, randomBytes(16).toString("hex"));
    if (!token) throw new NotFoundError("outlet", outletId);
    return token;
  },

  listTables(outletId: string) {
    assertOutletScope(outletId);
    return repo.listTables(getContext().tenantId, outletId);
  },

  async addTables(outletId: string, labels: string[]) {
    const ctx = getContext();
    if (!can(ctx.role, "outlet:write")) throw new ForbiddenError("cannot write tables");
    assertOutletScope(outletId);
    if (!(await repo.byId(ctx.tenantId, outletId))) throw new NotFoundError("outlet", outletId);
    return repo.addTables(ctx.tenantId, outletId, [...new Set(labels.map((l) => l.trim()))].filter(Boolean));
  },

  async deleteTable(tableId: string) {
    const ctx = getContext();
    if (!can(ctx.role, "outlet:write")) throw new ForbiddenError("cannot delete tables");
    if (!(await repo.deleteTable(ctx.tenantId, tableId))) throw new NotFoundError("table", tableId);
  },
});

export type OutletsService = ReturnType<typeof makeOutletsService>;
```

- [ ] **Step 6: Routes — extended PATCH schema**

In `routes.ts` replace `settingsSchema` with:

```ts
const settingsSchema = z
  .object({
    paperWidth: z.union([z.literal(PAPER_WIDTHS[0]), z.literal(PAPER_WIDTHS[1])]),
    // null clears the printer (back to browser-print only).
    printerIp: z.string().min(1).max(255).nullable(),
    printerPort: z.number().int().min(1).max(65535),
    name: z.string().trim().min(1).max(80),
    gstin: z.string().trim().length(15).nullable(),
    address: addressSchema,
    invoicePrefix: z.string().trim().min(1).max(8),
  })
  .partial()
  .refine((p) => Object.keys(p).length > 0, "nothing to update");
```

- [ ] **Step 7: Run tests**

Run: `bun test apps/api/src/modules/outlets && bun run typecheck`
Expected: 5 pass. Typecheck may flag `printing/service.ts` (uses `outlets.byId`) — it still compiles because the signature is unchanged.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/outlets
git commit -m "feat(outlets): active flag, menu mode, scoped list and owner-editable details"
```

---

### Task 4: Menu module — shared vs own menus and per-outlet sold-out

**Files:**
- Modify: `apps/api/src/modules/menu/domain.ts`
- Modify: `apps/api/src/modules/menu/ports.ts`
- Modify: `apps/api/src/modules/menu/repo.drizzle.ts`
- Modify: `apps/api/src/modules/menu/service.ts`
- Modify: `apps/api/src/modules/menu/routes.ts`
- Modify: `apps/api/src/modules/menu/menu.test.ts`

**Interfaces:**
- Consumes: `MenuMode` from `@odr/db/schema`; `assertOutletScope`.
- Produces: `Item.soldOutHere: boolean` (false when no outlet was asked). `MenuRepo.outletMenuMode(tenantId, outletId): Promise<MenuMode | null>` replaces `outletExistsInTenant`. `MenuRepo.soldOutItemIds(tenantId, outletId): Promise<Set<string>>`, `MenuRepo.setSoldOut(tenantId, outletId, itemId, soldOut): Promise<void>`. `listCategories(tenantId, outletId?, mode?)` and `listItems(tenantId, { categoryId?, outletId?, mode? })` — when `mode === "own"` only rows with that outlet id; when `"shared"` master ∪ outlet rows. Service: `setSoldOut(itemId, outletId, soldOut): Promise<Item>`. Route: `PUT /menu/items/:id/soldout` body `{ outletId, soldOut }`.

- [ ] **Step 1: Failing tests**

In `menu.test.ts`, replace `outletExistsInTenant` in `makeFakeRepo` and add sold-out state:

```ts
const MODES: Record<string, "shared" | "own"> = { [OUTLET_A]: "shared", [OUTLET_B]: "own" };

const makeFakeRepo = (): MenuRepo & { _categories: Category[]; _items: Item[]; _soldout: Set<string> } => {
  const _categories: Category[] = [];
  const _items: Item[] = [];
  const _soldout = new Set<string>(); // `${outletId}:${itemId}`
  const _images = new Map<string, { data: string; type: string }>();
  let i = 0;
  const newId = () => `cat-${++i}`;
  const visible = (rowOutlet: string | null, outletId?: string, mode?: "shared" | "own") =>
    outletId === undefined ? true : mode === "own" ? rowOutlet === outletId : rowOutlet === null || rowOutlet === outletId;
  return {
    _categories,
    _items,
    _soldout,
    async outletMenuMode(_t, id) {
      return MODES[id] ?? null;
    },
    async soldOutItemIds(_t, outletId) {
      return new Set([..._soldout].filter((k) => k.startsWith(`${outletId}:`)).map((k) => k.split(":")[1]!));
    },
    async setSoldOut(_t, outletId, itemId, soldOut) {
      const k = `${outletId}:${itemId}`;
      if (soldOut) _soldout.add(k);
      else _soldout.delete(k);
    },
    async listCategories(_t, outletId, mode) {
      return _categories.filter((c) => visible(c.outletId, outletId, mode));
    },
    // …keep createCategory, updateCategory, deleteCategory, updateItem, itemImage, deleteItem, createItem as they are…
    async listItems(_t, { categoryId, outletId, mode }) {
      return _items.filter((it) => (!categoryId || it.categoryId === categoryId) && visible(it.outletId, outletId, mode));
    },
  };
};
```

(Keep the existing tests; they exercise the shared path with `OUTLET_A`. Where an existing test creates rows with `outletId: OUTLET_A` and expects `outletId === OUTLET_A` on the stored row, change the expectation to `null` — shared-mode writes now land as master rows.) Add new tests at the end:

```ts
test("shared-mode outlets write master rows; own-mode outlets write their own", async () => {
  const repo = makeFakeRepo();
  const svc = makeMenuService({ repo, events: new InMemoryEventBus(), country: () => "IN" });
  await runWithContext(ctx, async () => {
    const shared = await svc.createCategory({ outletId: OUTLET_A, name: "Dosa" });
    const own = await svc.createCategory({ outletId: OUTLET_B, name: "Airport specials" });
    expect(shared.outletId).toBeNull();
    expect(own.outletId).toBe(OUTLET_B);

    // A reads master rows only; B reads its own rows only.
    expect((await svc.listCategories(OUTLET_A)).map((c) => c.name)).toEqual(["Dosa"]);
    expect((await svc.listCategories(OUTLET_B)).map((c) => c.name)).toEqual(["Airport specials"]);
  });
});

test("sold out is per outlet and folds into isActive for that outlet only", async () => {
  const repo = makeFakeRepo();
  const svc = makeMenuService({ repo, events: new InMemoryEventBus(), country: () => "IN" });
  await runWithContext(ctx, async () => {
    const cat = await svc.createCategory({ name: "Dosa" });
    const item = await svc.createItem({ categoryId: cat.id, name: "Masala Dosa", basePrice: "120.00", taxClass: "GST_5", isVeg: true });

    const off = await svc.setSoldOut(item.id, OUTLET_A, true);
    expect(off.soldOutHere).toBe(true);
    expect(off.isActive).toBe(false);

    const atA = (await svc.listItems({ outletId: OUTLET_A }))[0]!;
    expect(atA.isActive).toBe(false);
    expect(atA.soldOutHere).toBe(true);

    // The brand-wide flag is untouched — an admin listing (no outlet) still sees it on.
    const everywhere = (await svc.listItems({}))[0]!;
    expect(everywhere.isActive).toBe(true);
    expect(everywhere.soldOutHere).toBe(false);

    const back = await svc.setSoldOut(item.id, OUTLET_A, false);
    expect(back.isActive).toBe(true);
  });
});

test("a pinned captain cannot mark a dish sold out at another outlet", async () => {
  const repo = makeFakeRepo();
  const svc = makeMenuService({ repo, events: new InMemoryEventBus(), country: () => "IN" });
  let itemId = "";
  await runWithContext(ctx, async () => {
    const cat = await svc.createCategory({ name: "Dosa" });
    itemId = (await svc.createItem({ categoryId: cat.id, name: "Plain", basePrice: "90.00", taxClass: "GST_5", isVeg: true })).id;
  });
  await runWithContext({ ...ctx, role: "manager" as const, outletId: OUTLET_A }, async () => {
    await expect(svc.setSoldOut(itemId, OUTLET_B, true)).rejects.toThrow(/out of scope/);
    await expect(svc.listItems({ outletId: OUTLET_B })).rejects.toThrow(/out of scope/);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `bun test apps/api/src/modules/menu`
Expected: FAIL — `outletMenuMode`, `setSoldOut`, `soldOutHere` do not exist.

- [ ] **Step 3: Domain and ports**

`domain.ts`: add to `Item`:

```ts
  /** True when this outlet has 86'd the dish. Always false when no outlet was asked. */
  soldOutHere: boolean;
```

`ports.ts` full replacement:

```ts
import type { MenuMode } from "@odr/db/schema";
import type { Category, Item, ItemImage } from "./domain.ts";

/** Rows as stored — `soldOutHere` is folded in by the service, so repos return items without it. */
export type ItemRow = Omit<Item, "soldOutHere">;

export interface MenuRepo {
  /**
   * outletId undefined → every row (admin view).
   * outletId + mode 'shared' → master (outletId null) ∪ that outlet's rows.
   * outletId + mode 'own'    → only that outlet's rows.
   */
  listCategories(tenantId: string, outletId?: string, mode?: MenuMode): Promise<Category[]>;
  createCategory(tenantId: string, input: { outletId?: string; name: string; sortOrder?: number }): Promise<Category>;
  updateCategory(tenantId: string, id: string, patch: { name?: string; sortOrder?: number }): Promise<Category>;
  /** Hard delete. The service refuses unless the category holds no items. */
  deleteCategory(tenantId: string, id: string): Promise<void>;

  listItems(tenantId: string, opts: { categoryId?: string; outletId?: string; mode?: MenuMode }): Promise<ItemRow[]>;
  createItem(tenantId: string, input: {
    outletId?: string;
    categoryId: string;
    name: string;
    description?: string;
    basePrice: string;
    taxClass: string;
    isVeg: boolean;
    image?: ItemImage | null;
  }): Promise<ItemRow>;
  updateItem(tenantId: string, id: string, patch: {
    name?: string;
    description?: string | null;
    basePrice?: string;
    taxClass?: string;
    isVeg?: boolean;
    isActive?: boolean;
    /** undefined = untouched, null = remove the photo. */
    image?: ItemImage | null;
  }): Promise<ItemRow>;
  /**
   * Hard delete. order_lines carries no FK to menu_items and snapshots the
   * name and price at the time of sale, so removing a dish cannot change or
   * corrupt any past order or bill.
   */
  deleteItem(tenantId: string, id: string): Promise<void>;

  /** Photo bytes for one item — tenant-free because dish photos are public content. */
  itemImage(id: string): Promise<ItemImage | null>;

  /** The outlet's menu mode, or null when the outlet is not in this tenant. */
  outletMenuMode(tenantId: string, outletId: string): Promise<MenuMode | null>;

  /** Ids of items 86'd at this outlet. */
  soldOutItemIds(tenantId: string, outletId: string): Promise<Set<string>>;
  /** Idempotent insert / delete of the presence row. */
  setSoldOut(tenantId: string, outletId: string, itemId: string, soldOut: boolean): Promise<void>;
}
```

- [ ] **Step 4: Repo**

In `repo.drizzle.ts`: change the schema import to `import { menuCategories, menuItems, menuItemSoldout, outlets } from "@odr/db/schema";`, add `inArray` is not needed. Replace `listCategories`, `listItems`, `outletExistsInTenant`, and add the two sold-out methods:

```ts
  async listCategories(tenantId, outletId, mode) {
    const clauses: SQL[] = [eq(menuCategories.tenantId, tenantId)];
    if (outletId) {
      clauses.push(
        mode === "own"
          ? eq(menuCategories.outletId, outletId)
          : or(isNull(menuCategories.outletId), eq(menuCategories.outletId, outletId))!,
      );
    }
    return db.select().from(menuCategories).where(and(...clauses)!);
  },

  async listItems(tenantId, { categoryId, outletId, mode }) {
    const clauses: SQL[] = [eq(menuItems.tenantId, tenantId)];
    if (categoryId) clauses.push(eq(menuItems.categoryId, categoryId));
    if (outletId) {
      clauses.push(
        mode === "own"
          ? eq(menuItems.outletId, outletId)
          : or(isNull(menuItems.outletId), eq(menuItems.outletId, outletId))!,
      );
    }
    return db.select(itemCols).from(menuItems).where(and(...clauses)!);
  },

  async outletMenuMode(tenantId, outletId) {
    const rows = await db
      .select({ menuMode: outlets.menuMode })
      .from(outlets)
      .where(and(eq(outlets.tenantId, tenantId), eq(outlets.id, outletId)))
      .limit(1);
    return rows[0]?.menuMode ?? null;
  },

  async soldOutItemIds(tenantId, outletId) {
    const rows = await db
      .select({ itemId: menuItemSoldout.itemId })
      .from(menuItemSoldout)
      .where(and(eq(menuItemSoldout.tenantId, tenantId), eq(menuItemSoldout.outletId, outletId)));
    return new Set(rows.map((r) => r.itemId));
  },

  async setSoldOut(tenantId, outletId, itemId, soldOut) {
    if (soldOut) {
      await db.insert(menuItemSoldout).values({ tenantId, outletId, itemId }).onConflictDoNothing();
    } else {
      await db
        .delete(menuItemSoldout)
        .where(and(eq(menuItemSoldout.outletId, outletId), eq(menuItemSoldout.itemId, itemId)));
    }
  },
```

- [ ] **Step 5: Service**

Replace `service.ts` with:

```ts
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@odr/shared";
import { can } from "@odr/auth";
import { getTaxStrategy } from "@odr/tax";
import type { EventBus } from "@odr/events";
import type { MenuMode } from "@odr/db/schema";
import { assertOutletScope, getContext } from "@odr/tenancy";
import type { Item, ItemImage } from "./domain.ts";
import type { ItemRow, MenuRepo } from "./ports.ts";

export type MenuServiceDeps = {
  repo: MenuRepo;
  events: EventBus;
  country: () => string;
};

/** Menu names are matched the way a person would: trimmed, case-insensitive. */
const key = (name: string) => name.trim().toLowerCase();

const emit = (events: EventBus, name: string, tenantId: string, payload: unknown) =>
  events.publish({ name, tenantId, occurredAt: new Date().toISOString(), payload });

const assertTaxClass = (country: string, taxClass?: string) => {
  if (taxClass === undefined) return;
  const tax = getTaxStrategy(country);
  if (!tax.classes().includes(taxClass)) {
    throw new ValidationError(`invalid tax class for ${tax.country}`, { taxClass, allowed: tax.classes() });
  }
};

/** Item as the apps read it: isActive already answers "orderable at this outlet?". */
const withSoldOut = (row: ItemRow, soldOut: Set<string>): Item => ({
  ...row,
  isActive: row.isActive && !soldOut.has(row.id),
  soldOutHere: soldOut.has(row.id),
});

export const makeMenuService = ({ repo, events, country }: MenuServiceDeps) => {
  /** Mode of an outlet in the caller's tenant, after the pin check. */
  const modeOf = async (outletId: string): Promise<MenuMode> => {
    assertOutletScope(outletId);
    const mode = await repo.outletMenuMode(getContext().tenantId, outletId);
    if (!mode) throw new NotFoundError("outlet", outletId);
    return mode;
  };

  /** Where a write from `outletId` lands: master row in shared mode, outlet row in own mode. */
  const storageOutlet = async (outletId?: string): Promise<string | undefined> =>
    outletId && (await modeOf(outletId)) === "own" ? outletId : undefined;

  const svc = {
    async listCategories(outletId?: string) {
      const tenantId = getContext().tenantId;
      if (!outletId) return repo.listCategories(tenantId);
      return repo.listCategories(tenantId, outletId, await modeOf(outletId));
    },

    async createCategory(input: { outletId?: string; name: string; sortOrder?: number }) {
      const ctx = getContext();
      if (!can(ctx.role, "menu:write")) throw new ForbiddenError("cannot write menu");
      const cat = await repo.createCategory(ctx.tenantId, { ...input, outletId: await storageOutlet(input.outletId) });
      await emit(events, "menu.category.created", ctx.tenantId, cat);
      return cat;
    },

    async listItems(opts: { categoryId?: string; outletId?: string }): Promise<Item[]> {
      const tenantId = getContext().tenantId;
      if (!opts.outletId) {
        return (await repo.listItems(tenantId, opts)).map((r) => withSoldOut(r, new Set()));
      }
      const mode = await modeOf(opts.outletId);
      const [rows, soldOut] = await Promise.all([
        repo.listItems(tenantId, { ...opts, mode }),
        repo.soldOutItemIds(tenantId, opts.outletId),
      ]);
      return rows.map((r) => withSoldOut(r, soldOut));
    },

    /** Dish photos are public content (the diner menu shows them) — no tenant context. */
    itemImage: (id: string) => repo.itemImage(id),

    async createItem(input: {
      outletId?: string;
      categoryId: string;
      name: string;
      description?: string;
      basePrice: string;
      taxClass: string;
      isVeg: boolean;
      image?: ItemImage | null;
    }): Promise<Item> {
      const ctx = getContext();
      if (!can(ctx.role, "menu:write")) throw new ForbiddenError("cannot write menu");
      assertTaxClass(country(), input.taxClass);
      const row = await repo.createItem(ctx.tenantId, { ...input, outletId: await storageOutlet(input.outletId) });
      await emit(events, "menu.item.created", ctx.tenantId, row);
      return withSoldOut(row, new Set());
    },

    async updateItem(id: string, patch: {
      name?: string;
      description?: string | null;
      basePrice?: string;
      taxClass?: string;
      isVeg?: boolean;
      isActive?: boolean;
      image?: ItemImage | null;
    }): Promise<Item> {
      const ctx = getContext();
      if (!can(ctx.role, "menu:write")) throw new ForbiddenError("cannot write menu");
      assertTaxClass(country(), patch.taxClass);
      const row = await repo.updateItem(ctx.tenantId, id, patch);
      await emit(events, "menu.item.updated", ctx.tenantId, row);
      return withSoldOut(row, new Set());
    },

    /**
     * The daily 86: sold out at this outlet only. Brand-wide isActive is untouched.
     * ponytail: full-list scan to find one item; add repo.itemById if menus pass ~500 dishes.
     */
    async setSoldOut(itemId: string, outletId: string, soldOut: boolean): Promise<Item> {
      const ctx = getContext();
      if (!can(ctx.role, "menu:write")) throw new ForbiddenError("cannot write menu");
      await modeOf(outletId); // scope + existence
      const item = (await repo.listItems(ctx.tenantId, {})).find((r) => r.id === itemId);
      if (!item) throw new NotFoundError("item", itemId);
      await repo.setSoldOut(ctx.tenantId, outletId, itemId, soldOut);
      await emit(events, "menu.item.soldout", ctx.tenantId, { itemId, outletId, soldOut });
      return withSoldOut(item, await repo.soldOutItemIds(ctx.tenantId, outletId));
    },

    async deleteItem(id: string) {
      const ctx = getContext();
      if (!can(ctx.role, "menu:write")) throw new ForbiddenError("cannot write menu");
      await repo.deleteItem(ctx.tenantId, id);
      await emit(events, "menu.item.deleted", ctx.tenantId, { id });
    },

    async updateCategory(id: string, patch: { name?: string; sortOrder?: number }) {
      const ctx = getContext();
      if (!can(ctx.role, "menu:write")) throw new ForbiddenError("cannot write menu");
      const cat = await repo.updateCategory(ctx.tenantId, id, patch);
      await emit(events, "menu.category.updated", ctx.tenantId, cat);
      return cat;
    },

    async deleteCategory(id: string) {
      const ctx = getContext();
      if (!can(ctx.role, "menu:write")) throw new ForbiddenError("cannot write menu");
      // Deleting a category cascades to its items in Postgres — refuse unless
      // it is empty so a mis-tap cannot wipe half a menu.
      const items = await repo.listItems(ctx.tenantId, { categoryId: id });
      if (items.length > 0) {
        throw new ConflictError("move or delete this category's dishes first", { categoryId: id, items: items.length });
      }
      await repo.deleteCategory(ctx.tenantId, id);
      await emit(events, "menu.category.deleted", ctx.tenantId, { id });
    },

    /**
     * Create or update one dish, matched on (categoryId, name). This is what
     * the admin menu import runs on — re-importing a corrected price must
     * update the dish, not shadow it with a second one at the new price.
     */
    async upsertItem(input: {
      outletId?: string;
      categoryId: string;
      name: string;
      description?: string;
      basePrice: string;
      taxClass: string;
      isVeg: boolean;
    }): Promise<{ item: Item; created: boolean }> {
      const ctx = getContext();
      if (!can(ctx.role, "menu:write")) throw new ForbiddenError("cannot write menu");
      assertTaxClass(country(), input.taxClass);

      const existing = (await repo.listItems(ctx.tenantId, { categoryId: input.categoryId }))
        .find((i) => key(i.name) === key(input.name));

      if (!existing) return { item: await svc.createItem(input), created: true };

      const row = await repo.updateItem(ctx.tenantId, existing.id, {
        name: input.name,
        description: input.description ?? null,
        basePrice: input.basePrice,
        taxClass: input.taxClass,
        isVeg: input.isVeg,
      });
      await emit(events, "menu.item.updated", ctx.tenantId, row);
      return { item: withSoldOut(row, new Set()), created: false };
    },
  };
  return svc;
};

export type MenuService = ReturnType<typeof makeMenuService>;
```

- [ ] **Step 6: Route**

In `routes.ts` add after `r.patch("/items/:id", …)`:

```ts
  const soldoutSchema = z.object({ outletId: z.string().uuid(), soldOut: z.boolean() });

  // PUT /menu/items/:id/soldout — the daily 86, scoped to one outlet.
  r.put("/items/:id/soldout", async (c) => {
    const body = parse(soldoutSchema, await c.req.json());
    return c.json({ item: await svc.setSoldOut(c.req.param("id"), body.outletId, body.soldOut) });
  });
```

- [ ] **Step 7: Fix the remaining `outletExistsInTenant` references**

Run: `grep -rn "outletExistsInTenant" apps/api/src`
Expected: only `menu.test.ts` leftovers if any; delete them. The admin test (`admin.test.ts`) fakes `MenuService` with `listCategories/createCategory/upsertItem` — unchanged.

- [ ] **Step 8: Run tests**

Run: `bun test apps/api/src/modules/menu apps/api/src/modules/public apps/api/src/modules/admin && bun run typecheck`
Expected: all pass. The public module test fakes `MenuService`; if it fakes `listItems`, its items need `soldOutHere: false` for typing.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/menu apps/api/src/modules/public
git commit -m "feat(menu): shared vs own outlet menus and per-outlet sold-out"
```

---

### Task 5: Ordering, billing and printing honour the outlet pin

**Files:**
- Modify: `apps/api/src/modules/ordering/service.ts`
- Modify: `apps/api/src/modules/ordering/module.ts`
- Modify: `apps/api/src/modules/ordering/ordering.test.ts`
- Modify: `apps/api/src/modules/billing/ports.ts`, `repo.drizzle.ts`, `service.ts`, `routes.ts`, `billing.test.ts`
- Modify: `apps/api/src/modules/printing/service.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Consumes: `assertOutletScope`; `outlets.service.activeInTenant`.
- Produces: `OrderingServiceDeps.outletActive?: (tenantId: string, outletId: string) => Promise<boolean>`; `orderingModule({ db, events, outletActive? })`. `BillingRepo.list(tenantId, { outletId?: string; … })`; `BillingService.list({ outletId?: string; … })`; `BillSummary` gains `outletId: string`. `GET /billing/bills` with no `outletId` = every accessible outlet.

- [ ] **Step 1: Failing tests — ordering**

Append to `ordering.test.ts`:

```ts
test("an inactive outlet refuses new orders", async () => {
  const svc = makeOrderingService({ repo: inMemoryOrderRepo(), events: new InMemoryEventBus(), outletActive: async () => false });
  await runWithContext(ctx, async () => {
    await expect(svc.openTable({ outletId: ctx.outletId, tableLabel: "T1" })).rejects.toThrow(/closed/);
  });
});

test("pinned staff cannot open or list orders at another outlet", async () => {
  const svc = makeOrderingService({ repo: inMemoryOrderRepo(), events: new InMemoryEventBus() });
  const other = "99999999-9999-9999-9999-999999999999";
  await runWithContext({ ...ctx, role: "captain" as const }, async () => {
    await expect(svc.openTable({ outletId: other, tableLabel: "T1" })).rejects.toThrow(/out of scope/);
    await expect(svc.listOpen(other)).rejects.toThrow(/out of scope/);
    await expect(svc.listPendingKots(other)).rejects.toThrow(/out of scope/);
  });
});
```

(The existing `ctx` in that file already carries `outletId`, so the happy-path tests double as "pinned staff on their own outlet".)

- [ ] **Step 2: Failing tests — billing**

In `billing.test.ts` the fake repo's `list` becomes outlet-optional and returns `outletId`:

```ts
    async list(_t, { outletId }) {
      return bills.filter((b) => !outletId || b.outletId === outletId).map((b) => ({
        id: b.id, outletId: b.outletId, orderId: b.orderId, invoiceNumber: b.invoiceNumber, currency: b.currency,
        grandTotalMinor: b.grandTotalMinor, customerName: b.customerName,
        customerPhone: b.customerPhone, settledAt: b.settledAt,
      }));
    },
```

Append:

```ts
test("all-outlets bill list is for unpinned roles only", async () => {
  const svc = makeBillingService({ repo: fakeRepo(), events: new InMemoryEventBus(), country: () => "IN", orders: stubOrders([]) });
  await runWithContext(ctx, async () => {
    await expect(svc.list({})).resolves.toEqual([]);
  });
  await runWithContext({ ...ctx, role: "cashier" as const, outletId: OUTLET }, async () => {
    await expect(svc.list({})).rejects.toThrow(/out of scope/);
    await expect(svc.list({ outletId: OUTLET })).resolves.toEqual([]);
  });
});
```

- [ ] **Step 3: Run, expect failure**

Run: `bun test apps/api/src/modules/ordering apps/api/src/modules/billing`
Expected: FAIL on the new tests.

- [ ] **Step 4: Ordering service**

In `ordering/service.ts`:

```ts
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, newId } from "@odr/shared";
import { assertOutletScope, getContext } from "@odr/tenancy";

export type OrderingServiceDeps = {
  repo: OrderRepo;
  events: EventBus;
  /** Closed branches refuse new orders. Defaults to "open" so tests and the diner path need no lookup. */
  outletActive?: (tenantId: string, outletId: string) => Promise<boolean>;
};

export const makeOrderingService = ({ repo, events, outletActive }: OrderingServiceDeps) => ({
  async openTable(input) {
    const ctx = getContext();
    if (!can(ctx.role, "order:create")) throw new ForbiddenError("cannot open orders");
    assertOutletScope(input.outletId);
    if (outletActive && !(await outletActive(ctx.tenantId, input.outletId))) {
      throw new ConflictError("this outlet is closed", { outletId: input.outletId });
    }
    // …rest unchanged…
```

and at the bottom:

```ts
  listOpen(outletId: string) {
    assertOutletScope(outletId);
    return repo.listOpen(getContext().tenantId, outletId);
  },
  byId: (id: string) => repo.byId(getContext().tenantId, id),
  listPendingKots(outletId: string) {
    assertOutletScope(outletId);
    return repo.listPendingKots(getContext().tenantId, outletId);
  },
  kotById: (kotId: string) => repo.kotById(getContext().tenantId, kotId),
```

`ordering/module.ts`:

```ts
export const orderingModule = ({ db, events, outletActive }: { db: DB; events: EventBus; outletActive?: OrderingServiceDeps["outletActive"] }) => {
  const repo = drizzleOrderRepo(db);
  const svc = makeOrderingService({ repo, events, outletActive });
  return { routes: buildOrderingRoutes(svc), service: svc };
};
```

(import `OrderingServiceDeps` from `./service.ts`; keep whatever the file currently names the drizzle repo factory.)

- [ ] **Step 5: app.ts wiring**

In `apps/api/src/app.ts` build outlets before ordering and pass the lookup:

```ts
  const outlets = outletsModule({ db, events });
  const ordering = orderingModule({ db, events, outletActive: outlets.service.activeInTenant });
```

(Delete the later `const outlets = …` line.)

- [ ] **Step 6: Billing**

`billing/domain.ts`: add `outletId: string;` to `BillSummary` (find the type; it lists `id, orderId, invoiceNumber, currency, grandTotalMinor, customerName, customerPhone, settledAt`).

`billing/ports.ts`: `list(tenantId: string, opts: { outletId?: string; from?: string; to?: string; limit: number }): Promise<BillSummary[]>;` with doc "Invoices for one outlet, or every outlet when omitted, newest first."

`billing/repo.drizzle.ts` `list`:

```ts
  async list(tenantId, { outletId, from, to, limit }) {
    const clauses = [eq(bills.tenantId, tenantId)];
    if (outletId) clauses.push(eq(bills.outletId, outletId));
    if (from) clauses.push(gte(bills.settledAt, new Date(from)));
    if (to) clauses.push(lte(bills.settledAt, new Date(to)));
    const rows = await db
      .select({
        id: bills.id,
        outletId: bills.outletId,
        orderId: bills.orderId,
        // …the existing columns…
```

`billing/service.ts`:

```ts
import { assertOutletScope, getContext } from "@odr/tenancy";
// …
  byId: (id: string) => repo.byId(getContext().tenantId, id),

  /** One outlet, or every outlet the caller may see (unpinned roles only). */
  list(opts: { outletId?: string; from?: string; to?: string; limit?: number }) {
    const ctx = getContext();
    if (!can(ctx.role, "billing:read")) throw new ForbiddenError("cannot read bills");
    if (opts.outletId) assertOutletScope(opts.outletId);
    else if (ctx.outletId) throw new ForbiddenError("outlet out of scope");
    // ponytail: capped list, no cursor. Add paging when a shift exceeds 500 bills.
    return repo.list(ctx.tenantId, { ...opts, limit: Math.min(opts.limit ?? 200, 500) });
  },
```

Also guard the settle path: after `const order = await orders.byIdForBilling(...)` add `assertOutletScope(order.outletId);` (system auto-settle runs unpinned, so it passes).

`billing/routes.ts`:

```ts
  r.get("/bills", async (c) => {
    const bills = await svc.list({
      ...(c.req.query("outletId") ? { outletId: c.req.query("outletId")! } : {}),
      ...(c.req.query("from") ? { from: c.req.query("from")! } : {}),
      ...(c.req.query("to") ? { to: c.req.query("to")! } : {}),
    });
    return c.json({ bills: bills.map(serializeSummary) });
  });
```

and add `outletId: string;` to `serializeSummary`'s parameter type.

- [ ] **Step 7: Printing**

In `printing/service.ts` `testPrint`, after the permission check add `assertOutletScope(outletId);` (import from `@odr/tenancy`). `printKot`/`printBill` go through `outlets.byId`, which already asserts scope (Task 3).

- [ ] **Step 8: Run tests**

Run: `bun test apps/api && bun run typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): outlet pin enforced in ordering, billing and printing; closed outlets refuse orders; all-outlets bill list"
```

---

### Task 6: Staff carry an outlet

**Files:**
- Modify: `apps/api/src/modules/identity/domain.ts`, `ports.ts`, `repo.drizzle.ts`, `service.ts`, `routes.ts`, `identity.test.ts`

**Interfaces:**
- Produces: `StaffMember` gains `outletId: string | null; outletName: string | null`. `IdentityRepo.addMembership(tenantId, userId, role, outletId: string | null)`; `IdentityRepo.outletExists(tenantId, outletId): Promise<boolean>`. `createStaff(input: { …; outletId?: string })`. `POST /staff` body accepts `outletId?: uuid`.

- [ ] **Step 1: Failing tests**

Append to `identity.test.ts`:

```ts
const OUTLET = "55555555-5555-5555-5555-555555555555";

const repoForCreate = () => {
  const added: { userId: string; role: string; outletId: string | null }[] = [];
  const repo = {
    findUserByEmail: async () => null,
    createUser: async (i: { email: string; fullName: string }) => ({ id: "new-user", email: i.email, fullName: i.fullName }),
    listMemberships: async () => [],
    outletExists: async (_t: string, id: string) => id === OUTLET,
    addMembership: async (_t: string, userId: string, role: string, outletId: string | null) => {
      added.push({ userId, role, outletId });
    },
  } as unknown as IdentityRepo;
  return { repo, added };
};

test("a captain must be pinned to an outlet; a manager is never pinned", async () => {
  const { repo, added } = repoForCreate();
  await asOwner(repo, async (svc) => {
    await expect(
      svc.createStaff({ email: "c@x.dev", password: "password1", fullName: "C", role: "captain" }),
    ).rejects.toThrow(/outlet/);
    await expect(
      svc.createStaff({ email: "c@x.dev", password: "password1", fullName: "C", role: "captain", outletId: "not-here" }),
    ).rejects.toThrow(/outlet/);
    await svc.createStaff({ email: "c@x.dev", password: "password1", fullName: "C", role: "captain", outletId: OUTLET });
    await svc.createStaff({ email: "m@x.dev", password: "password1", fullName: "M", role: "manager", outletId: OUTLET });
  });
  expect(added).toEqual([
    { userId: "new-user", role: "captain", outletId: OUTLET },
    { userId: "new-user", role: "manager", outletId: null },
  ]);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `bun test apps/api/src/modules/identity`
Expected: FAIL — `outletExists` unused, no outlet validation.

- [ ] **Step 3: Domain, ports, repo**

`domain.ts`:

```ts
export type StaffMember = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  /** null = every outlet (owner / manager). */
  outletId: string | null;
  outletName: string | null;
};
```

`ports.ts`: change `addMembership` and add `outletExists`:

```ts
  addMembership(tenantId: string, userId: string, role: Role, outletId: string | null): Promise<void>;
  outletExists(tenantId: string, outletId: string): Promise<boolean>;
```

`repo.drizzle.ts`: import `outlets` from `@odr/db/schema`, then

```ts
  async listStaff(tenantId) {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: memberships.role,
        outletId: memberships.outletId,
        outletName: outlets.name,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .leftJoin(outlets, eq(outlets.id, memberships.outletId))
      .where(eq(memberships.tenantId, tenantId))
      .orderBy(users.fullName);
    return rows;
  },

  async addMembership(tenantId, userId, role, outletId) {
    await db
      .insert(memberships)
      .values({ tenantId, userId, role, outletId })
      .onConflictDoUpdate({ target: [memberships.tenantId, memberships.userId], set: { role, outletId } });
  },

  async outletExists(tenantId, outletId) {
    const rows = await db
      .select({ id: outlets.id })
      .from(outlets)
      .where(and(eq(outlets.tenantId, tenantId), eq(outlets.id, outletId)))
      .limit(1);
    return rows.length > 0;
  },
```

- [ ] **Step 4: Service**

Replace `createStaff` in `service.ts`:

```ts
  /**
   * Adds a staff member to the caller's tenant. An email that already has an
   * account is re-used (people work at two restaurants) — only the membership
   * is created. Owners and managers see every outlet; everyone else is pinned
   * to exactly one.
   */
  async createStaff(input: { email: string; password: string; fullName: string; role: Role; outletId?: string }) {
    const ctx = getContext();
    if (!can(ctx.role, "user:write")) throw new ForbiddenError("cannot write staff");

    const unpinned = input.role === "owner" || input.role === "manager";
    let outletId: string | null = null;
    if (!unpinned) {
      if (!input.outletId) throw new ValidationError("this role must be assigned to an outlet", { role: input.role });
      if (!(await repo.outletExists(ctx.tenantId, input.outletId))) throw new NotFoundError("outlet", input.outletId);
      outletId = input.outletId;
    }

    const existing = await repo.findUserByEmail(input.email);
    const user = existing ?? (await repo.createUser({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      fullName: input.fullName,
    }));
    if (existing && (await repo.listMemberships(user.id)).some((m) => m.tenantId === ctx.tenantId)) {
      throw new ConflictError("already a staff member", { email: input.email });
    }
    await repo.addMembership(ctx.tenantId, user.id, input.role, outletId);
    return { id: user.id, email: user.email, fullName: user.fullName, role: input.role, outletId };
  },
```

Add `ValidationError` to the `@odr/shared` import.

- [ ] **Step 5: Route schema**

In `routes.ts`:

```ts
const staffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  role: z.enum(["owner", "manager", "captain", "cashier", "kitchen"]),
  outletId: z.string().uuid().optional(),
});
```

- [ ] **Step 6: Run tests**

Run: `bun test apps/api/src/modules/identity && bun run typecheck`
Expected: pass. (`admin/repo.drizzle.ts` `addOwnerMembership` inserts without `outletId` — that is fine, NULL is the owner default.)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/identity
git commit -m "feat(staff): pin captains, cashiers and kitchen to an outlet"
```

---

### Task 7: Admin API — outlets under a restaurant, outlet count, import target

**Files:**
- Modify: `apps/api/src/modules/admin/domain.ts`, `ports.ts`, `repo.drizzle.ts`, `service.ts`, `routes.ts`, `admin.test.ts`

**Interfaces:**
- Produces: `outletCodeFor(name: string): string` (pure). `TenantRow.outletCount: number`. `AdminRepo.listOutlets(tenantId)`, `AdminRepo.createOutlet(input: { tenantId; name; code; gstin?; address; invoicePrefix; menuMode })` → `{ id }`, `AdminRepo.outletCodeExists(tenantId, code)`, `AdminRepo.setOutletActive(tenantId, outletId, isActive)`. Routes: `GET/POST /admin/restaurants/:tenantId/outlets`, `PATCH /admin/restaurants/:tenantId/outlets/:outletId`, `POST …/menu/import` body may carry `outletId`. `listRestaurants()` rows include `outletCount`.

- [ ] **Step 1: Failing tests**

Append to `admin.test.ts`:

```ts
import { outletCodeFor } from "./domain.ts";

test("outlet code is an upper-case slug capped at 16 chars", () => {
  expect(outletCodeFor("Spice Route – Airport Road")).toBe("SPICE-ROUTE-AIRP");
  expect(outletCodeFor("  ")).toBe("OUTLET");
});

test("adding an outlet picks a free code and honours the menu choice", async () => {
  const created: unknown[] = [];
  const repo = {
    tenantById: async () => ({ id: "t-1", name: "X", slug: "x", subscriptionStart: null, subscriptionEnd: null, createdAt: "", outletCount: 1 }),
    outletCodeExists: async (_t: string, code: string) => code === "AIRPORT",
    createOutlet: async (input: unknown) => {
      created.push(input);
      return { id: "o-2" };
    },
  } as unknown as AdminRepo;
  const svc = makeAdminService({ repo, menu: {} as MenuService });
  const res = await svc.createOutlet("t-1", {
    name: "Airport",
    address: { line1: "Terminal 1", city: "Mangalore", state: "Karnataka", pincode: "574142", country: "IN" },
    menuMode: "own",
  });
  expect(res).toEqual({ outletId: "o-2", code: "AIRPORT-2" });
  expect(created[0]).toMatchObject({ tenantId: "t-1", code: "AIRPORT-2", menuMode: "own", invoicePrefix: "A" });
});
```

Also extend the existing import test's `fakeRepo` tenant with `outletCount: 1` (typing).

- [ ] **Step 2: Run, expect failure**

Run: `bun test apps/api/src/modules/admin`
Expected: FAIL — `outletCodeFor`, `createOutlet` missing.

- [ ] **Step 3: Domain**

Append to `admin/domain.ts`:

```ts
/** Outlet code: upper-case slug, ≤16 chars (the outlets.code column is what bills and QR sheets show). */
export const outletCodeFor = (name: string): string =>
  slugify(name).toUpperCase().replace(/^-|-$/g, "").slice(0, 16).replace(/-$/, "") || "OUTLET";
```

Note `slugify("  ")` returns `"restaurant"`; guard first:

```ts
export const outletCodeFor = (name: string): string => {
  if (!name.trim()) return "OUTLET";
  return slugify(name).toUpperCase().slice(0, 16).replace(/-$/, "");
};
```

Use the second form.

- [ ] **Step 4: Ports and repo**

`ports.ts`: add `outletCount: number;` to `TenantRow`; add

```ts
export type OutletRow = {
  id: string;
  name: string;
  code: string;
  gstin: string | null;
  city: string;
  invoicePrefix: string;
  isActive: boolean;
  menuMode: MenuMode;
  createdAt: string;
};
```

(import `MenuMode` from `@odr/db/schema`) and change/extend the repo interface:

```ts
  listOutlets(tenantId: string): Promise<OutletRow[]>;
  outletCodeExists(tenantId: string, code: string): Promise<boolean>;
  createOutlet(input: {
    tenantId: string;
    name: string;
    code: string;
    gstin?: string;
    address: { line1: string; line2?: string; city: string; state: string; pincode: string; country: string };
    invoicePrefix: string;
    menuMode: MenuMode;
  }): Promise<{ id: string }>;
  setOutletActive(tenantId: string, outletId: string, isActive: boolean): Promise<boolean>;
```

`repo.drizzle.ts`: add `outletCount` to `tenantCols`, and the new methods:

```ts
import { and, desc, eq, sql } from "drizzle-orm";

const tenantCols = {
  id: tenants.id,
  name: tenants.name,
  slug: tenants.slug,
  subscriptionStart: tenants.subscriptionStart,
  subscriptionEnd: tenants.subscriptionEnd,
  createdAt: tenants.createdAt,
  outletCount: sql<number>`(select count(*)::int from ${outlets} o where o.tenant_id = ${tenants.id})`,
};
```

(`toTenant`'s parameter type gains `outletCount: number`.)

```ts
  async listOutlets(tenantId) {
    const rows = await db.select().from(outlets).where(eq(outlets.tenantId, tenantId)).orderBy(outlets.createdAt);
    return rows.map((o) => ({
      id: o.id,
      name: o.name,
      code: o.code,
      gstin: o.gstin,
      city: o.address.city,
      invoicePrefix: o.invoicePrefix,
      isActive: o.isActive,
      menuMode: o.menuMode,
      createdAt: o.createdAt.toISOString(),
    }));
  },

  async outletCodeExists(tenantId, code) {
    const rows = await db
      .select({ id: outlets.id })
      .from(outlets)
      .where(and(eq(outlets.tenantId, tenantId), eq(outlets.code, code)))
      .limit(1);
    return rows.length > 0;
  },

  async createOutlet({ tenantId, name, code, gstin, address, invoicePrefix, menuMode }) {
    const [o] = await db
      .insert(outlets)
      .values({ tenantId, name, code, gstin, address, invoicePrefix, menuMode })
      .returning({ id: outlets.id });
    if (!o) throw new Error("failed to insert outlet");
    return o;
  },

  async setOutletActive(tenantId, outletId, isActive) {
    const rows = await db
      .update(outlets)
      .set({ isActive })
      .where(and(eq(outlets.tenantId, tenantId), eq(outlets.id, outletId)))
      .returning({ id: outlets.id });
    return rows.length > 0;
  },
```

`createRestaurant` in the service must now pass the placeholder address and `menuMode: "shared"` to `createOutlet`:

```ts
    const outlet = await repo.createOutlet({
      tenantId: tenant.id,
      name: input.name,
      code: slug.toUpperCase(),
      gstin: input.gstin,
      // ponytail: the team fills the real address in later via /api/v1/outlets.
      address: { line1: "-", city: "-", state: "-", pincode: "-", country: "IN" },
      invoicePrefix: invoicePrefixFor(input.name),
      menuMode: "shared",
    });
```

(and delete the hard-coded address from the repo's `createOutlet`).

- [ ] **Step 5: Service**

Add to `makeAdminService`:

```ts
  listOutlets: async (tenantId: string) => {
    if (!(await repo.tenantById(tenantId))) throw new NotFoundError("tenant", tenantId);
    return repo.listOutlets(tenantId);
  },

  /** Second, third… outlet for a brand. `menuMode` is the "share the brand menu?" answer. */
  async createOutlet(tenantId: string, input: {
    name: string;
    gstin?: string;
    address: { line1: string; line2?: string; city: string; state: string; pincode: string; country: string };
    invoicePrefix?: string;
    menuMode: MenuMode;
  }) {
    if (!(await repo.tenantById(tenantId))) throw new NotFoundError("tenant", tenantId);
    const base = outletCodeFor(input.name);
    let code = base;
    for (let n = 2; await repo.outletCodeExists(tenantId, code); n++) code = `${base.slice(0, 14)}-${n}`;
    const { id } = await repo.createOutlet({
      tenantId,
      name: input.name,
      code,
      gstin: input.gstin,
      address: input.address,
      invoicePrefix: input.invoicePrefix ?? invoicePrefixFor(input.name),
      menuMode: input.menuMode,
    });
    return { outletId: id, code };
  },

  async setOutletActive(tenantId: string, outletId: string, isActive: boolean) {
    if (!(await repo.setOutletActive(tenantId, outletId, isActive))) throw new NotFoundError("outlet", outletId);
    return { outletId, isActive };
  },
```

Import `MenuMode` from `@odr/db/schema` and `outletCodeFor` from `./domain.ts`. In `listRestaurants` add `outletCount: t.outletCount,` to the mapped row.

`importMenu(tenantId, categories, outletId?)`: pass `outletId` into `menu.listCategories(outletId)`, `menu.createCategory({ name: cat.name, outletId })` and `menu.upsertItem({ …, outletId })`. Signature: `async importMenu(tenantId: string, categories: ImportCategory[], outletId?: string)`.

- [ ] **Step 6: Routes**

In `admin/routes.ts` add schemas and routes:

```ts
const addressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(3),
  country: z.string().length(2),
});

const createOutletSchema = z.object({
  name: z.string().trim().min(1).max(80),
  gstin: z.string().length(15).optional(),
  address: addressSchema,
  invoicePrefix: z.string().trim().min(1).max(8).optional(),
  menuMode: z.enum(["shared", "own"]),
});

const patchOutletSchema = z.object({ isActive: z.boolean() });
```

The import schema becomes a union that also accepts `outletId`: wrap the existing `importSchema` as `importSchema.and(z.object({ outletId: z.string().uuid().optional() }))` and pass `body.outletId` to `svc.importMenu`.

```ts
  r.get("/restaurants/:tenantId/outlets", async (c) =>
    c.json({ outlets: await svc.listOutlets(c.req.param("tenantId")) }));

  r.post("/restaurants/:tenantId/outlets", async (c) => {
    const body = parse(createOutletSchema, await c.req.json());
    return c.json(await svc.createOutlet(c.req.param("tenantId"), body), 201);
  });

  r.patch("/restaurants/:tenantId/outlets/:outletId", async (c) => {
    const body = parse(patchOutletSchema, await c.req.json());
    return c.json(await svc.setOutletActive(c.req.param("tenantId"), c.req.param("outletId"), body.isActive));
  });
```

- [ ] **Step 7: Run tests**

Run: `bun test apps/api/src/modules/admin && bun run typecheck`
Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/admin
git commit -m "feat(admin): list/add/deactivate outlets, outlet count, per-outlet menu import"
```

---

### Task 8: Captain PWA — session model, API types, outlet picker at login

**Files:**
- Modify: `apps/captain-pwa/src/lib/session.ts`
- Modify: `apps/captain-pwa/src/lib/session.test.ts`
- Modify: `apps/captain-pwa/src/lib/api.ts`
- Modify: `apps/captain-pwa/src/routes/login.tsx`

**Interfaces:**
- Produces (session.ts): `Session.outlets: { id: string; name: string }[]`, `Session.menuMode: "shared" | "own"`, `LAST_OUTLET_KEY = "odr.lastOutlet"`, `SESSION_EVENT = "odr:session"`, `pickOutlet(outlets, lastId): Outlet | null` (one outlet → it; several with a remembered match → that; otherwise null), `outletPatch(outlet: Outlet): Partial<Session>`, `rememberOutlet(id)`. `setSession` dispatches `SESSION_EVENT` on `window`.
- Produces (api.ts): `Outlet` gains `isActive: boolean; menuMode: "shared" | "own"`; `patchOutlet` patch type gains `name?, gstin?: string | null, address?, invoicePrefix?`; `Staff` gains `outletId: string | null; outletName: string | null`; `addStaff` input gains `outletId?`; `MenuItem.soldOutHere?: boolean`; `setSoldOut(itemId, outletId, soldOut)`; `bills(outletId: string | null, from?, to?)`; `BillSummary.outletId: string`.

- [ ] **Step 1: Failing test**

Append to `session.test.ts`:

```ts
import { pickOutlet } from "./session.ts";

const A = { id: "a", name: "Central" };
const B = { id: "b", name: "Airport" };

test("pickOutlet: one outlet is automatic, a remembered one wins, otherwise ask", () => {
  expect(pickOutlet([A], null)).toEqual(A);
  expect(pickOutlet([A, B], "b")).toEqual(B);
  expect(pickOutlet([A, B], "zzz")).toBeNull();
  expect(pickOutlet([A, B], null)).toBeNull();
  expect(pickOutlet([], null)).toBeNull();
});
```

- [ ] **Step 2: Run, expect failure**

Run: `bun test apps/captain-pwa/src/lib`
Expected: FAIL — `pickOutlet` not exported.

- [ ] **Step 3: session.ts**

Add to the `Session` interface after `outletName`:

```ts
  /** Every outlet this login may work at — >1 shows the switcher. */
  outlets: { id: string; name: string }[];
  menuMode: "shared" | "own";
```

Add exports:

```ts
export const LAST_OUTLET_KEY = "odr.lastOutlet";
/** Fired on window whenever the stored session changes (login, switch, patch). */
export const SESSION_EVENT = "odr:session";

/**
 * Which outlet to land on. One → it. Several with the one this device used
 * last → that. Otherwise null: show the picker.
 */
export const pickOutlet = <T extends { id: string }>(outlets: T[], lastId: string | null): T | null => {
  if (outlets.length === 1) return outlets[0]!;
  return outlets.find((o) => o.id === lastId) ?? null;
};

export const rememberOutlet = (id: string): void => {
  try { localStorage.setItem(LAST_OUTLET_KEY, id); } catch { /* private mode */ }
};

export const lastOutlet = (): string | null => {
  try { return localStorage.getItem(LAST_OUTLET_KEY); } catch { return null; }
};

/** Session fields that come from an outlet row — used by login and the switcher alike. */
export const outletPatch = (o: {
  id: string;
  name: string;
  gstin?: string | null;
  address?: Parameters<typeof addressLine>[0];
  paperWidth?: number;
  printerIp?: string | null;
  printerPort?: number;
  menuMode?: "shared" | "own";
}): Partial<Session> => ({
  outletId: o.id,
  outletName: o.name,
  outletGstin: o.gstin ?? null,
  outletAddress: addressLine(o.address),
  paperWidth: o.paperWidth ?? 80,
  printerIp: o.printerIp ?? null,
  printerPort: o.printerPort ?? 9100,
  menuMode: o.menuMode ?? "shared",
});
```

Make `setSession` notify and `clearSession` too:

```ts
export const setSession = (s: Session): void => {
  localStorage.setItem(KEY, JSON.stringify(s));
  localStorage.setItem("odr.token", s.token);
  window.dispatchEvent(new Event(SESSION_EVENT));
};

export const clearSession = (): void => {
  localStorage.removeItem(KEY);
  localStorage.removeItem("odr.token");
  window.dispatchEvent(new Event(SESSION_EVENT));
};
```

`getSession` must tolerate sessions saved before this change: after parsing, `return s.token ? { outlets: [], menuMode: "shared", ...s } : null;`.

Note `session.test.ts` runs under bun without DOM: `pickOutlet` is pure, but importing `session.ts` evaluates no `window` at module load, so the test still runs.

- [ ] **Step 4: api.ts types and endpoints**

Edit the types:

```ts
export interface Outlet {
  id: string;
  name: string;
  code: string;
  gstin?: string | null;
  address?: { line1?: string; line2?: string; city?: string; state?: string; pincode?: string; country?: string };
  invoicePrefix?: string;
  paperWidth?: number;
  printerIp?: string | null;
  printerPort?: number;
  isActive: boolean;
  menuMode: "shared" | "own";
}
```

(keep any existing fields the interface already has beyond these). Add `soldOutHere?: boolean;` to `MenuItem`. Add `outletId: string;` to `BillSummary`. Change `Staff`:

```ts
export interface Staff {
  id: string;
  email: string;
  fullName: string;
  role: string;
  outletId: string | null;
  outletName: string | null;
}
```

Endpoints:

```ts
  patchOutlet: (
    id: string,
    patch: {
      paperWidth?: number;
      printerIp?: string | null;
      printerPort?: number;
      name?: string;
      gstin?: string | null;
      address?: { line1: string; line2?: string; city: string; state: string; pincode: string; country: string };
      invoicePrefix?: string;
    },
  ) => send<{ outlet: Outlet }>("PATCH", `/api/v1/outlets/${id}`, patch).then((r) => r.outlet),

  addStaff: (input: { email: string; password: string; fullName: string; role: string; outletId?: string }) =>
    send<{ staff: Staff }>("POST", "/api/v1/staff", input),

  /** The daily 86 — sold out at this outlet only. */
  setSoldOut: (itemId: string, outletId: string, soldOut: boolean) =>
    send<{ item: MenuItem }>("PUT", `/api/v1/menu/items/${itemId}/soldout`, { outletId, soldOut }).then((r) => r.item),

  /** null outlet = every outlet the login may see (owner / manager). */
  bills: (outletId: string | null, from?: string, to?: string) =>
    get<{ bills: BillSummary[] }>(
      `/api/v1/billing/bills?` +
        [
          outletId ? `outletId=${outletId}` : "",
          from ? `from=${encodeURIComponent(from)}` : "",
          to ? `to=${encodeURIComponent(to)}` : "",
        ].filter(Boolean).join("&"),
    ).then((r) => r.bills),
```

`patchOutlet` previously returned `{ outlet }`; grep for `api.patchOutlet(` (only `settings.tsx`, which ignores the result) before changing the return shape.

- [ ] **Step 5: login.tsx — outlet step**

Add state and the picker. Imports: `import { addressLine, clearSession, lastOutlet, outletPatch, pickOutlet, rememberOutlet, setSession, type Session } from "../lib/session.ts";` and `type Outlet` from `../lib/api.ts`.

```tsx
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [outlets, setOutlets] = useState<Outlet[] | null>(null);
  const [pending, setPending] = useState<Session | null>(null);
```

Replace the body of `signIn` after `needsTenant` with:

```tsx
      // Token must be stored before the outlet lookup — api.ts reads it.
      const base: Session = {
        token: res.token,
        userId: res.user.id,
        email: res.user.email,
        role: res.role,
        outletId: "",
        outletName: "",
        outlets: [],
        menuMode: "shared",
        paperWidth: 80,
        subscriptionEndsAt: res.subscriptionEndsAt,
      };
      setSession(base);
      const list = (await api.outlets()).filter((o) => o.isActive);
      if (list.length === 0) {
        clearSession();
        setError("This account has no outlet yet. Ask Odr to finish setup.");
        return;
      }
      const chosen = pickOutlet(list, lastOutlet());
      if (!chosen) {
        setPending(base);
        setOutlets(list);
        return;
      }
      enter(base, list, chosen);
```

Add the helper inside the component:

```tsx
  const enter = (base: Session, list: Outlet[], outlet: Outlet) => {
    rememberOutlet(outlet.id);
    setSession({
      ...base,
      ...outletPatch(outlet),
      outlets: list.map((o) => ({ id: o.id, name: o.name })),
    } as Session);
    navigate({ name: "tables" });
  };
```

Render the outlet step right after the `tenants ? (…)` branch, same styling:

```tsx
        ) : outlets && pending ? (
          <div className="w-full max-w-[340px] mx-auto my-auto py-10">
            <button
              onClick={() => { clearSession(); setOutlets(null); setPending(null); }}
              className="inline-flex items-center gap-1.5 text-[13px] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] min-h-11"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">Choose an outlet</h2>
            <p className="mt-1.5 text-[14px] text-[var(--fg-tertiary)]">
              You can switch any time from the top bar.
            </p>
            <div className="mt-6 grid gap-2">
              {outlets.map((o) => (
                <button
                  key={o.id}
                  onClick={() => enter(pending, outlets, o)}
                  className="min-h-12 px-4 text-left rounded-[var(--radius-2)] bg-[var(--bg-canvas)]
                             ring-1 ring-[var(--line-default)] hover:bg-[var(--bg-surface-2)]"
                >
                  <span className="block text-[15px] font-medium">{o.name}</span>
                  <span className="block text-[12px] text-[var(--fg-tertiary)]">{addressLine(o.address) || o.code}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
```

Remove the now-unused second `setSession({...})` block from the old flow.

- [ ] **Step 6: Run tests and typecheck**

Run: `bun test apps/captain-pwa && bun run typecheck`
Expected: pass. Typecheck will point at every place that builds a `Session` literal or reads `api.bills(…)`/`Staff` — `bills.tsx`, `settings.tsx`, `tables.tsx` still compile because `bills(outletId: string | null)` accepts a string. Fix any `Session` literal in tests by adding `outlets: [], menuMode: "shared"`.

- [ ] **Step 7: Commit**

```bash
git add apps/captain-pwa/src/lib apps/captain-pwa/src/routes/login.tsx
git commit -m "feat(pwa): outlet-aware session and outlet picker at login"
```

---

### Task 9: Captain PWA — outlet switcher in the topbar

**Files:**
- Create: `apps/captain-pwa/src/shell/outlet-switcher.tsx`
- Modify: `apps/captain-pwa/src/shell/topbar.tsx`
- Modify: `apps/captain-pwa/src/shell/app-shell.tsx`
- Modify: `apps/captain-pwa/src/app.tsx`

**Interfaces:**
- Consumes: `Session.outlets`, `outletPatch`, `rememberOutlet`, `patchSession`, `SESSION_EVENT`, `api.outlets()`, `Sheet/SheetContent/SheetTitle` from `@odr/ui`.
- Produces: `<OutletSwitcher session={session} />` renders the outlet name; a button when `session.outlets.length > 1`.

- [ ] **Step 1: The switcher**

Create `apps/captain-pwa/src/shell/outlet-switcher.tsx`:

```tsx
import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, cn } from "@odr/ui";
import { api } from "../lib/api.ts";
import { navigate } from "../lib/router.ts";
import { toast } from "../lib/toast.tsx";
import { outletPatch, patchSession, rememberOutlet, type Session } from "../lib/session.ts";

/**
 * Outlet name in the topbar. With one outlet it is plain text; with several
 * it opens a bottom sheet. Switching patches the session — every screen keys
 * its data on session.outletId, so the floor, kitchen and sales refetch.
 */
export const OutletSwitcher = ({ session }: { session: Session }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const many = session.outlets.length > 1;

  const pick = async (id: string) => {
    if (id === session.outletId) return setOpen(false);
    setBusy(id);
    try {
      const outlet = (await api.outlets()).find((o) => o.id === id);
      if (!outlet) throw new Error("That outlet is no longer available");
      rememberOutlet(id);
      patchSession(outletPatch(outlet));
      setOpen(false);
      navigate({ name: "tables" });
      toast(`Now working at ${outlet.name}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not switch outlet");
    } finally {
      setBusy(null);
    }
  };

  if (!many) {
    return <span className="block text-[14px] font-medium tracking-[-0.01em] truncate">{session.outletName}</span>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Switch outlet"
        className="flex items-center gap-1 min-h-11 -ml-1 px-1 rounded-[var(--radius-2)]
                   text-[14px] font-medium tracking-[-0.01em] hover:bg-[var(--bg-surface-2)]"
      >
        <span className="truncate">{session.outletName}</span>
        <ChevronDown size={14} className="shrink-0 text-[var(--fg-muted)]" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="max-w-lg mx-auto">
          <SheetTitle>Switch outlet</SheetTitle>
          <ul className="mt-4 grid gap-2">
            {session.outlets.map((o) => {
              const active = o.id === session.outletId;
              return (
                <li key={o.id}>
                  <button
                    onClick={() => void pick(o.id)}
                    disabled={busy !== null}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "w-full flex items-center gap-3 min-h-12 px-4 text-left text-[15px] rounded-[var(--radius-2)]",
                      "ring-1 ring-[var(--line-default)] disabled:opacity-60",
                      active ? "bg-[var(--accent-soft)] font-medium" : "bg-[var(--bg-canvas)] hover:bg-[var(--bg-surface-2)]",
                    )}
                  >
                    <span className="flex-1 truncate">{o.name}</span>
                    {busy === o.id ? <Loader2 size={16} className="animate-spin" /> : active ? <Check size={16} className="text-[var(--accent)]" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
};
```

- [ ] **Step 2: Topbar takes the session**

`topbar.tsx`: change props to `{ session: Session }`, import `OutletSwitcher` and `type Session`, and replace the identity block:

```tsx
      <div className="min-w-0">
        <OutletSwitcher session={session} />
        <span className="block text-[12px] text-[var(--fg-tertiary)] truncate">
          {session.email} · {session.role}
        </span>
      </div>
```

`app-shell.tsx`: `<Topbar session={session} />`.

- [ ] **Step 3: App re-reads the session on the event**

In `app.tsx` replace the `useEffect(() => setSession(getSession()), [route]);` line with:

```tsx
  useEffect(() => setSession(getSession()), [route]);
  useEffect(() => {
    const on = () => setSession(getSession());
    window.addEventListener(SESSION_EVENT, on);
    return () => window.removeEventListener(SESSION_EVENT, on);
  }, []);
```

and import `SESSION_EVENT` from `./lib/session.ts`.

- [ ] **Step 4: Run in the browser**

Run: `bun run dev:api` and `bun run dev:web` (two terminals), sign in as the seeded owner. With one outlet the topbar shows plain text. Add a second outlet through the admin API (Task 7) — for example:

```bash
curl -s -X POST localhost:3000/admin/restaurants/<tenantId>/outlets \
  -H "authorization: Bearer $ADMIN_KEY" -H 'content-type: application/json' \
  -d '{"name":"Airport","address":{"line1":"T1","city":"Mangalore","state":"Karnataka","pincode":"574142","country":"IN"},"menuMode":"shared"}'
```

Sign out and back in: expect the "Choose an outlet" step, then the chevron in the topbar, and the tables screen swapping when you pick the other outlet.

Run: `bun run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add apps/captain-pwa/src/shell apps/captain-pwa/src/app.tsx
git commit -m "feat(pwa): outlet switcher in the topbar"
```

---

### Task 10: Captain PWA — Outlet tab and staff outlet picker in Settings

**Files:**
- Modify: `apps/captain-pwa/src/routes/settings.tsx`

**Interfaces:**
- Consumes: `api.patchOutlet` (extended), `api.addStaff({ …, outletId })`, `Staff.outletName`, `patchSession`, `outletPatch`.

- [ ] **Step 1: Tabs**

```ts
type SettingsTab = "outlet" | "tables" | "printing" | "staff";

const TABS: { key: SettingsTab; label: string }[] = [
  { key: "outlet", label: "Outlet" },
  { key: "tables", label: "Tables" },
  { key: "printing", label: "Printing" },
  { key: "staff", label: "Staff" },
];
```

Default tab: `useState<SettingsTab>("outlet")`. Render `{tab === "outlet" ? <OutletSection session={session} /> : null}`.

- [ ] **Step 2: OutletSection**

Add after the `Field` helper:

```tsx
/* ---------------------------------------------------------------- outlet -- */

const OutletSection = ({ session }: { session: Session }) => {
  // Fetch the full row: the session only carries the address as one line.
  const q = useAsync(() => api.outlets().then((all) => all.find((o) => o.id === session.outletId) ?? null), [session.outletId]);
  const [form, setForm] = useState<{
    name: string; gstin: string; line1: string; line2: string; city: string; state: string; pincode: string; invoicePrefix: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const o = q.data;
  if (o && form === null) {
    setForm({
      name: o.name,
      gstin: o.gstin ?? "",
      line1: o.address?.line1 === "-" ? "" : (o.address?.line1 ?? ""),
      line2: o.address?.line2 ?? "",
      city: o.address?.city === "-" ? "" : (o.address?.city ?? ""),
      state: o.address?.state === "-" ? "" : (o.address?.state ?? ""),
      pincode: o.address?.pincode === "-" ? "" : (o.address?.pincode ?? ""),
      invoicePrefix: o.invoicePrefix ?? "INV",
    });
  }

  const save = async () => {
    if (!form || !o) return;
    setBusy(true);
    try {
      const updated = await api.patchOutlet(o.id, {
        name: form.name.trim(),
        gstin: form.gstin.trim() || null,
        address: {
          line1: form.line1.trim() || "-",
          ...(form.line2.trim() ? { line2: form.line2.trim() } : {}),
          city: form.city.trim() || "-",
          state: form.state.trim() || "-",
          pincode: form.pincode.trim() || "-",
          country: o.address?.country ?? "IN",
        },
        invoicePrefix: form.invoicePrefix.trim().toUpperCase() || "INV",
      });
      // Bills print the header from the session — keep it current.
      patchSession(outletPatch(updated));
      toast("Outlet details saved");
      q.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof NonNullable<typeof form>) => (e: { target: { value: string } }) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  return (
    <Section
      title="Outlet"
      hint={
        session.menuMode === "own"
          ? "This outlet has its own menu."
          : session.outlets.length > 1
            ? "Shares the brand menu with your other outlets."
            : "Name, GSTIN and address as printed on every bill."
      }
    >
      {!form ? (
        <p className="text-[13px] text-[var(--fg-muted)]">{q.error ?? "Loading…"}</p>
      ) : (
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); void save(); }}
        >
          <Field label="Outlet name"><Input required value={form.name} onChange={set("name")} className="h-11" /></Field>
          <Field label="GSTIN"><Input value={form.gstin} onChange={set("gstin")} placeholder="29ABCDE1234F1Z5" maxLength={15} className="h-11 font-mono uppercase" /></Field>
          <Field label="Address line 1"><Input value={form.line1} onChange={set("line1")} className="h-11" /></Field>
          <Field label="Address line 2"><Input value={form.line2} onChange={set("line2")} className="h-11" /></Field>
          <Field label="City"><Input value={form.city} onChange={set("city")} className="h-11" /></Field>
          <Field label="State"><Input value={form.state} onChange={set("state")} className="h-11" /></Field>
          <Field label="PIN code"><Input value={form.pincode} onChange={set("pincode")} inputMode="numeric" className="h-11" /></Field>
          <Field label="Invoice prefix"><Input value={form.invoicePrefix} onChange={set("invoicePrefix")} maxLength={8} className="h-11 font-mono uppercase" /></Field>
          <Button type="submit" size="lg" disabled={busy} className="sm:col-span-2 sm:w-auto sm:justify-self-start">
            {busy ? <Loader2 size={16} className="animate-spin" /> : null} Save
          </Button>
        </form>
      )}
    </Section>
  );
};
```

Import `outletPatch` from `../lib/session.ts`.

- [ ] **Step 3: Staff outlet select**

In `StaffSection`:

```ts
const BLANK_MEMBER = { fullName: "", email: "", password: "", role: "captain", outletId: "" };
```

Where the form opens (`setForm(BLANK_MEMBER)`), use `setForm({ ...BLANK_MEMBER, outletId: session.outletId })`. In `add`:

```ts
      const pinned = form.role !== "owner" && form.role !== "manager";
      await api.addStaff({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        role: form.role,
        ...(pinned ? { outletId: form.outletId } : {}),
      });
```

Add `"kitchen"` to `ROLES` (the API accepts it; the picker never offered it): `const ROLES = ["captain", "cashier", "kitchen", "manager", "owner"];`

Below the Role field, add:

```tsx
              {form.role !== "owner" && form.role !== "manager" ? (
                <Field label="Works at">
                  <select
                    value={form.outletId}
                    onChange={(e) => setForm({ ...form, outletId: e.target.value })}
                    className="h-11 w-full px-3 text-[14px] rounded-[var(--radius-2)]
                               bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]
                               focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    {session.outlets.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <p className="self-end pb-3 text-[12px] text-[var(--fg-tertiary)]">Sees every outlet.</p>
              )}
```

In the staff list row, show the outlet under the email:

```tsx
                <span className="block text-[12px] text-[var(--fg-tertiary)] truncate">
                  {s.email}{s.outletName ? ` · ${s.outletName}` : session.outlets.length > 1 ? " · all outlets" : ""}
                </span>
```

- [ ] **Step 4: Verify in the browser and typecheck**

Run: `bun run typecheck`. In the app: Settings → Outlet, change the name, save, open a bill: the header shows the new name. Settings → Staff → Add member as captain: the "Works at" select shows the outlets.

- [ ] **Step 5: Commit**

```bash
git add apps/captain-pwa/src/routes/settings.tsx
git commit -m "feat(pwa): outlet details tab and staff outlet assignment"
```

---

### Task 11: Captain PWA — per-outlet sold-out in the menu editor

**Files:**
- Modify: `apps/captain-pwa/src/routes/menu.tsx`

- [ ] **Step 1: Toggle writes the per-outlet flag**

Replace `toggleSoldOut`:

```tsx
  // The one action that happens every day — kept to a single tap. Per outlet:
  // 86'ing a dish here leaves the other outlets selling it.
  const toggleSoldOut = (i: MenuItem) =>
    run(
      () => api.setSoldOut(i.id, outletId, !i.soldOutHere),
      i.soldOutHere ? `${i.name} is back on` : `${i.name} marked sold out`,
    );
```

- [ ] **Step 2: Rows read `soldOutHere`**

In the item row component: `const off = item.soldOutHere === true || item.isActive === false;` and the toggle label uses `off` as before. (`isActive` already folds sold-out in from the API; keeping both keeps older API builds working.)

- [ ] **Step 3: Subtitle**

```tsx
          <p className="mt-1 text-[13px] text-[var(--fg-tertiary)]">
            {session.outletName} ·{" "}
            {session.menuMode === "own"
              ? "this outlet's own menu"
              : session.outlets.length > 1
                ? "shared brand menu · sold out is per outlet"
                : "changes are live for waiters and diners at once"}
          </p>
```

- [ ] **Step 4: Typecheck and try it**

Run: `bun run typecheck`. In the app with two shared-mode outlets: mark a dish sold out at one, switch outlet, the dish is still on.

- [ ] **Step 5: Commit**

```bash
git add apps/captain-pwa/src/routes/menu.tsx
git commit -m "feat(pwa): sold-out is per outlet"
```

---

### Task 12: Captain PWA — Sales across all outlets

**Files:**
- Modify: `apps/captain-pwa/src/routes/bills.tsx`

**Interfaces:**
- Consumes: `api.bills(null, from)`, `BillSummary.outletId`, `Session.outlets`, `canManage`.

- [ ] **Step 1: Scope state and fetch**

```tsx
import { canManage, canSeeSales, type Session } from "../lib/session.ts";

export const BillsRoute = ({ session }: { session: Session }) => {
  const [q, setQ] = useState("");
  const canAll = canManage(session.role) && session.outlets.length > 1;
  const [scope, setScope] = useState<"outlet" | "all">("outlet");
  const all = canAll && scope === "all";
  const outletId = session.outletId;

  const data = useAsync(
    async () => {
      const [bills, open] = await Promise.all([
        api.bills(all ? null : outletId, midnight(1).toISOString()),
        // Open orders stay per outlet — the floor is a place, takings are a total.
        api.openOrders(outletId),
      ]);
      return { bills, open };
    },
    [outletId, all],
    15000,
  );
```

- [ ] **Step 2: Segmented control in the header**

Replace the `<header>`:

```tsx
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-semibold tracking-[-0.02em]">Sales &amp; invoices</h1>
          <p className="mt-1 text-[13px] text-[var(--fg-tertiary)]">
            {all ? `All ${session.outlets.length} outlets` : session.outletName} · refreshes every 15 seconds
          </p>
        </div>
        {canAll ? (
          <div
            role="tablist"
            aria-label="sales scope"
            className="flex p-1 gap-1 rounded-[var(--radius-pill)] bg-[var(--bg-surface-2)] ring-1 ring-[var(--line-subtle)]"
          >
            {([["outlet", "This outlet"], ["all", "All outlets"]] as const).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={scope === k}
                onClick={() => setScope(k)}
                className={`px-4 min-h-10 rounded-[var(--radius-pill)] text-[13px] transition-colors duration-[var(--dur-quick)] ${
                  scope === k ? "bg-[var(--bg-surface)] font-medium shadow-[var(--shadow-1)]" : "text-[var(--fg-muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </header>
```

- [ ] **Step 3: Per-outlet strip and row prefix**

After the stats `<section>`, add:

```tsx
      {all ? (
        <section className="mb-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {session.outlets.map((o) => {
            const mine = insight.today.filter((b) => b.outletId === o.id);
            return (
              <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-[var(--radius-3)] bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]">
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium truncate">{o.name}</span>
                  <span className="block text-[12px] text-[var(--fg-tertiary)]">{mine.length} bill{mine.length === 1 ? "" : "s"} today</span>
                </span>
                <Money minor={sum(mine)} mono className="text-[15px] font-medium" />
              </div>
            );
          })}
        </section>
      ) : null}
```

In the invoice row, prefix the invoice number with the outlet name when `all`:

```tsx
                  <span className="block font-mono text-[13px] truncate">
                    {all ? `${outletName(b.outletId)} · ` : ""}{b.invoiceNumber}
                  </span>
```

with `const outletName = (id: string) => session.outlets.find((o) => o.id === id)?.name ?? "";` defined inside the component. Hide the "Not settled yet" section when `all` is on (it is per outlet): wrap its condition as `!all && open.length > 0`. The "Still open" and "Taken today" stats stay per outlet; label them `hint={all ? \`${session.outletName} only\` : …}` so the reader is not misled.

- [ ] **Step 4: Typecheck and try it**

Run: `bun run typecheck`. In the app as owner with two outlets: Sales shows the toggle; "All outlets" lists bills from both with the outlet prefix.

- [ ] **Step 5: Commit**

```bash
git add apps/captain-pwa/src/routes/bills.tsx
git commit -m "feat(pwa): all-outlets view on the sales screen"
```

---

### Task 13: Admin console — outlets section

**Files:**
- Modify: `apps/admin/src/api.ts`
- Modify: `apps/admin/src/drawer.tsx`
- Modify: `apps/admin/src/app.tsx`

**Interfaces:**
- Consumes Task 7's routes.
- Produces (api.ts): `Restaurant.outletCount?: number`; `AdminOutlet` type; `api.outlets(key, tenantId)`, `api.createOutlet(key, tenantId, payload)`, `api.setOutletActive(key, tenantId, outletId, isActive)`; `api.importMenu(key, tenantId, payload, outletId?)`.

- [ ] **Step 1: api.ts**

`call` only knows GET and POST; add a method parameter:

```ts
async function call<T>(key: string, path: string, body?: unknown, method?: "PATCH"): Promise<T> {
  // …
      method: method ?? (body === undefined ? "GET" : "POST"),
```

Types and endpoints:

```ts
export type AdminOutlet = {
  id: string;
  name: string;
  code: string;
  gstin: string | null;
  city: string;
  invoicePrefix: string;
  isActive: boolean;
  menuMode: "shared" | "own";
  createdAt: string;
};

export type CreateOutletPayload = {
  name: string;
  gstin?: string;
  address: { line1: string; line2?: string; city: string; state: string; pincode: string; country: string };
  invoicePrefix?: string;
  menuMode: "shared" | "own";
};
```

Add `outletCount?: number;` to `Restaurant`. In `api`:

```ts
  outlets: (key: string, id: string) =>
    call<{ outlets: AdminOutlet[] }>(key, `/restaurants/${id}/outlets`).then((r) => r.outlets),
  createOutlet: (key: string, id: string, p: CreateOutletPayload) =>
    call<{ outletId: string; code: string }>(key, `/restaurants/${id}/outlets`, p),
  setOutletActive: (key: string, id: string, outletId: string, isActive: boolean) =>
    call<{ outletId: string; isActive: boolean }>(key, `/restaurants/${id}/outlets/${outletId}`, { isActive }, "PATCH"),
  importMenu: (key: string, id: string, payload: unknown, outletId?: string) =>
    call<{ categoriesCreated: number; itemsCreated: number; itemsUpdated: number }>(
      key,
      `/restaurants/${id}/menu/import`,
      outletId ? { ...(payload as object), outletId } : payload,
    ),
```

(`drawer.tsx` currently reads `res.items`/`res.categories` from the import result, which the API never returned — switch it to `itemsCreated + itemsUpdated` and `categoriesCreated` while here.)

- [ ] **Step 2: Drawer — outlets section**

Add state and loader in `Drawer`:

```tsx
  const [outlets, setOutlets] = useState<AdminOutlet[] | null>(null);
  const [outletError, setOutletError] = useState("");
  const [addingOutlet, setAddingOutlet] = useState(false);
  const [outletForm, setOutletForm] = useState({
    name: "", gstin: "", line1: "", city: "", state: "Karnataka", pincode: "", menuMode: "shared" as "shared" | "own",
  });
  const [outletBusy, setOutletBusy] = useState(false);
  const [outletOk, setOutletOk] = useState("");
  const [importTarget, setImportTarget] = useState<string>(""); // "" = shared brand menu

  const loadOutlets = () => {
    setOutletError("");
    api.outlets(adminKey, id).then(setOutlets).catch((e: unknown) => { setOutlets([]); fail(e, setOutletError); });
  };
  useEffect(loadOutlets, [id]);

  async function submitOutlet(e: React.FormEvent) {
    e.preventDefault();
    setOutletError("");
    setOutletOk("");
    if (!outletForm.name.trim()) return setOutletError("Outlet name is required.");
    if (!outletForm.city.trim()) return setOutletError("City is required.");
    setOutletBusy(true);
    try {
      const res = await api.createOutlet(adminKey, id, {
        name: outletForm.name.trim(),
        ...(outletForm.gstin.trim() ? { gstin: outletForm.gstin.trim() } : {}),
        address: {
          line1: outletForm.line1.trim() || "-",
          city: outletForm.city.trim(),
          state: outletForm.state.trim() || "-",
          pincode: outletForm.pincode.trim() || "-",
          country: "IN",
        },
        menuMode: outletForm.menuMode,
      });
      setOutletOk(`Outlet added with code ${res.code}. The owner can now switch to it in the app.`);
      setOutletForm({ ...outletForm, name: "", gstin: "", line1: "", city: "", pincode: "" });
      setAddingOutlet(false);
      loadOutlets();
      onChanged();
    } catch (err) {
      fail(err, setOutletError);
    } finally {
      setOutletBusy(false);
    }
  }

  const toggleOutlet = (o: AdminOutlet) =>
    api.setOutletActive(adminKey, id, o.id, !o.isActive).then(loadOutlets).catch((e: unknown) => fail(e, setOutletError));
```

Insert this section first inside `<div className="space-y-8 px-6 py-6">`:

```tsx
          <section>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Outlets</h3>
                <p className="mt-0.5 text-xs text-muted">Pricing is per outlet. Closed outlets keep their bills but take no orders.</p>
              </div>
              <Button variant="ghost" onClick={() => setAddingOutlet((v) => !v)}>
                {addingOutlet ? "Cancel" : "Add outlet"}
              </Button>
            </div>

            {addingOutlet ? (
              <form onSubmit={submitOutlet} className="mt-4 space-y-3 rounded-lg border bg-surface p-4">
                <Field label="Outlet name">
                  <input className={inputClass} placeholder="Spice Route – Airport Road" value={outletForm.name} onChange={(e) => setOutletForm({ ...outletForm, name: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="GSTIN" hint="optional">
                    <input className={inputClass} value={outletForm.gstin} onChange={(e) => setOutletForm({ ...outletForm, gstin: e.target.value })} />
                  </Field>
                  <Field label="Address line">
                    <input className={inputClass} value={outletForm.line1} onChange={(e) => setOutletForm({ ...outletForm, line1: e.target.value })} />
                  </Field>
                  <Field label="City">
                    <input className={inputClass} value={outletForm.city} onChange={(e) => setOutletForm({ ...outletForm, city: e.target.value })} />
                  </Field>
                  <Field label="State">
                    <input className={inputClass} value={outletForm.state} onChange={(e) => setOutletForm({ ...outletForm, state: e.target.value })} />
                  </Field>
                  <Field label="PIN code">
                    <input className={inputClass} inputMode="numeric" value={outletForm.pincode} onChange={(e) => setOutletForm({ ...outletForm, pincode: e.target.value })} />
                  </Field>
                </div>
                <fieldset className="space-y-1.5">
                  <legend className="mb-1.5 block text-xs font-medium tracking-wide text-muted">Menu</legend>
                  {([["shared", "Share the brand menu", "One menu for every outlet. Each outlet marks its own sold-out dishes."], ["own", "Own menu", "Starts empty. Import this outlet's menu below."]] as const).map(([v, label, hint]) => (
                    <label key={v} className="flex items-start gap-2 text-sm">
                      <input type="radio" name="menuMode" className="mt-1" checked={outletForm.menuMode === v} onChange={() => setOutletForm({ ...outletForm, menuMode: v })} />
                      <span><span className="font-medium">{label}</span><span className="block text-xs text-muted">{hint}</span></span>
                    </label>
                  ))}
                </fieldset>
                {outletError ? <Note kind="error">{outletError}</Note> : null}
                <Button disabled={outletBusy}>{outletBusy ? "Adding…" : "Add outlet"}</Button>
              </form>
            ) : null}

            {outletOk ? <div className="mt-3"><Note kind="success">{outletOk}</Note></div> : null}
            {!addingOutlet && outletError ? <div className="mt-3"><Note kind="error">{outletError}</Note></div> : null}

            <div className="mt-3 overflow-hidden rounded-lg border">
              {outlets === null ? (
                <p className="px-4 py-4 text-xs text-muted">Loading…</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr className="border-b">
                      <th className="px-4 py-2 font-medium">Outlet</th>
                      <th className="px-4 py-2 font-medium">Code</th>
                      <th className="px-4 py-2 font-medium">Menu</th>
                      <th className="px-4 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {outlets.map((o) => (
                      <tr key={o.id} className={`border-b last:border-0 ${o.isActive ? "" : "opacity-60"}`}>
                        <td className="px-4 py-2.5">
                          <span className="block font-medium">{o.name}</span>
                          <span className="block text-xs text-muted">{o.city === "-" ? "address pending" : o.city}{o.gstin ? ` · ${o.gstin}` : ""}</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs">{o.code}</td>
                        <td className="px-4 py-2.5 text-xs">{o.menuMode === "own" ? "Own" : "Shared"}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Button variant="ghost" onClick={() => void toggleOutlet(o)}>{o.isActive ? "Close" : "Reopen"}</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
```

In the **Import menu** section, above the textarea, when any outlet has `menuMode === "own"`:

```tsx
              {outlets?.some((o) => o.menuMode === "own") ? (
                <Field label="Import into">
                  <select className={inputClass} value={importTarget} onChange={(e) => setImportTarget(e.target.value)}>
                    <option value="">Shared brand menu</option>
                    {outlets.filter((o) => o.menuMode === "own").map((o) => (
                      <option key={o.id} value={o.id}>{o.name} (own menu)</option>
                    ))}
                  </select>
                </Field>
              ) : null}
```

and call `api.importMenu(adminKey, id, built.body, importTarget || undefined)`. Import `type AdminOutlet` from `./api.ts`.

- [ ] **Step 3: Restaurant list — outlet count**

In `app.tsx` `List`, add a header cell `<th className="px-5 py-2.5 font-medium">Outlets</th>` after "Restaurant" and a body cell `<td className="px-5 py-3 font-mono">{r.outletCount ?? "—"}</td>`.

- [ ] **Step 4: Typecheck and try it**

Run: `bun run typecheck`, then `bun run dev:api` + `bun run dev:admin`; open a restaurant, add an outlet with "Own menu", import a small CSV into it, then sign in to the PWA as that owner and switch to the new outlet: the menu shows only the imported dishes.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src
git commit -m "feat(admin): outlets section with menu sharing choice and per-outlet import"
```

---

### Task 14: Seed, docs, full verification

**Files:**
- Modify: `packages/db/src/seed.ts`
- Modify: `docs/superpowers/specs/2026-09-03-multi-outlet-design.md` (status line only)

- [ ] **Step 1: Seed a second outlet for local demos**

After the first outlet in `seed.ts`:

```ts
const secondCode = "MNG-AIRPORT";
const second = (await db.select().from(outlets).where(and(eq(outlets.tenantId, tenant.id), eq(outlets.code, secondCode))).limit(1))[0]
  ?? (await db.insert(outlets).values({
    tenantId: tenant.id,
    name: "Mangalore Airport",
    code: secondCode,
    address: { line1: "Kenjar", city: "Mangalore", state: "Karnataka", pincode: "574142", country: "IN" },
    invoicePrefix: "MA",
    menuMode: "shared",
  }).returning())[0]!;
console.log(`outlet id=${second.id} code=${second.code}`);
```

(import `and` from `drizzle-orm`).

- [ ] **Step 2: Full verification**

Run: `bun test && bun run typecheck && bun run build:web`
Expected: every test passes, typecheck clean, three web bundles build.

Manual pass (against the seeded demo): owner logs in → picker with two outlets → picks one → topbar chevron → switch → tables screen swaps; a captain created with "Works at: Airport" logs in straight into Airport and gets a toast "outlet out of scope" if a stale link targets Central; Sales "All outlets" shows both prefixes; sold out at one outlet does not affect the other.

- [ ] **Step 3: Mark the spec shipped and commit**

Change the spec's `Status:` line to `Status: implemented 2026-09-03 (see plans/2026-09-03-multi-outlet.md)`.

```bash
git add packages/db/src/seed.ts docs/superpowers/specs/2026-09-03-multi-outlet-design.md
git commit -m "chore: seed a second demo outlet; mark multi-outlet spec implemented"
```

---

## Self-review

- **Spec coverage:** data model (T1), scope guard + middleware (T2), outlets API incl. richer PATCH and inactive refusal (T3, T5), menu modes + sold-out + `PUT …/soldout` (T4), billing optional outlet (T5), staff outlet (T6), admin outlets/count/import target (T7), PWA login picker + remembered outlet (T8), switcher (T9), Settings Outlet tab + staff select (T10), menu editor (T11), Sales toggle (T12), admin console (T13), seed (T14). Diner app and KDS need nothing — sold-out folds into `isActive`, KDS keys on `session.outletId`.
- **Type consistency:** `assertOutletScope(outletId)` everywhere; `MenuMode` from `@odr/db/schema`; `Item.soldOutHere`; `ItemRow` is repo-side only; `BillSummary.outletId`; `Session.outlets/menuMode`; `outletPatch` used by login, switcher and Settings; admin `importMenu(key, id, payload, outletId?)`.
- **Known simplifications (ponytail):** `setSoldOut` scans the item list; no per-outlet price; staff pinned to one outlet only; admin deactivate only (no delete).
