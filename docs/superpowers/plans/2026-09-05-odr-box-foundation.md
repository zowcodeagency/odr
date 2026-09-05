# Odr Box Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One executable that runs the existing Odr API and staff app on a restaurant's own computer with an embedded database, sets itself up on first run, and needs no internet.

**Architecture:** The API (Hono on Bun) and the built captain PWA are bundled into a single Bun executable. The database driver in `packages/db` gains a PGlite path (Postgres compiled to WASM, data in a folder) chosen at start-up by the Box entry point; the cloud keeps postgres.js. A first-run setup route, enabled only in the Box, creates the restaurant through the existing admin service. An `offline` flag in the runtime config hides features that need the internet.

**Tech Stack:** Bun 1.3 (`bun build --compile`), Hono, Drizzle 0.45 with `drizzle-orm/pglite`, `@electric-sql/pglite`, React captain PWA, `@fontsource` for bundled fonts.

**Spec:** `docs/superpowers/specs/2026-09-05-odr-box-offline-design.md` — this plan implements components 1, 2, 3 and the hidden-feature and font rules. Components 4–6 (license, updates, versioning) and 7–9 (backup, install, moving data) are the next two plans.

## Global Constraints

- One codebase. No module other than entry points and `packages/db` may know whether it runs in the cloud or the Box (spec §10).
- Migrations are append-only; never edit or delete a file in `packages/db/drizzle` (spec §6).
- The cloud Worker bundle must not import PGlite or WASM. PGlite lives in `packages/db/src/pglite.ts`, imported only by the Box.
- Hidden on the Box behind `window.__ODR.offline`: diner QR ordering. "Bills on the device" stays hidden because the Box never sets `tenants.local_billing` (spec, Shape).
- Fonts must load with no internet (spec, verified facts).
- Work on branch `box`. Commits: conventional prefix, lower-case subject, under 100 characters, no trailers (repo `CLAUDE.md`, commitlint).
- `bun run typecheck` and `bun test` must pass before every commit (husky runs tsc on staged `.ts`).
- Ponytail: shortest working diff; mark deliberate shortcuts with a `// ponytail:` comment naming the ceiling.

---

## File structure

| File | Responsibility |
|---|---|
| `packages/db/src/index.ts` (modify) | Widen `DB` type so both drivers fit; add `setDb()` so an entry point can install a pre-built database. |
| `packages/db/src/pglite.ts` (create) | Open PGlite on a folder, wrap in Drizzle, run the migration folder. Only the Box imports it. |
| `packages/db/src/pglite.test.ts` (create) | Migrations apply to an empty PGlite database and a tenant round-trips. |
| `dev/spike-pglite.ts` (create, task 1 only) | Throwaway: proves PGlite works inside a compiled Bun executable. Deleted at the end of task 1. |
| `apps/api/src/app.ts` (modify) | `buildApp({ setup })` mounts the setup routes only when asked. |
| `apps/api/src/modules/admin/setup.ts` (create) | `GET /setup` and `POST /setup`, open only while no tenant exists. |
| `apps/api/src/modules/admin/setup.test.ts` (create) | Setup closes after the first restaurant. |
| `apps/box/package.json`, `apps/box/src/main.ts` (create) | Box entry: data folder, secret, PGlite, migrations, API + static app on one port. |
| `apps/box/src/assets.gen.ts` (generated) | One `with { type: "file" }` import per built captain file; written by the build script. |
| `apps/box/src/box.test.ts` (create) | Boots the Box on a temp folder and walks setup → login over HTTP. |
| `dev/build-box.ts` (create) | Builds the captain app, generates `assets.gen.ts`, compiles the executable per target. |
| `apps/captain-pwa/src/index.html`, `index.css`, `package.json` (modify) | Fonts from `@fontsource` instead of Google. |
| `apps/captain-pwa/src/lib/config.ts` (create) | Typed access to `window.__ODR` including `offline`. |
| `apps/captain-pwa/src/routes/more.tsx`, `settings.tsx`, `app.tsx` (modify) | Hide the QR sheet and QR section when offline. |
| `apps/captain-pwa/src/lib/api.ts` (modify) | `setupStatus()` and `setup()` calls. |
| `apps/captain-pwa/src/routes/setup.tsx` (create) | First-run form. |
| `apps/captain-pwa/src/routes/login.tsx` (modify) | Shows the setup form when the API says setup is needed. |

---

### Task 1: Spike — PGlite inside a compiled Bun executable

This task answers the one open risk in the spec. Its code is throwaway. Its output is a yes/no written into the spec.

**Files:**
- Modify: `packages/db/package.json` (add dependency)
- Create: `dev/spike-pglite.ts` (delete at the end)
- Modify: `docs/superpowers/specs/2026-09-05-odr-box-offline-design.md` (record the result under Risks)

- [ ] **Step 1: Add PGlite to the db package**

Run from the repo root:
```bash
bun add --cwd packages/db @electric-sql/pglite
```
Expected: `packages/db/package.json` gains `"@electric-sql/pglite": "^0.3.x"` (whatever the current version is) and `bun.lock` changes.

- [ ] **Step 2: Write the spike script**

`dev/spike-pglite.ts`:
```ts
/* Throwaway. Proves: PGlite opens a folder, our migrations apply, a row round-trips —
 * under `bun run` and inside `bun build --compile`. Delete after task 1. */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as schema from "../packages/db/src/schema/index.ts";

// Migrations folder: relative to this file when run with bun; compiled binaries
// get it via ODR_MIGRATIONS (we copy the folder next to the exe for the spike).
const migrationsFolder = process.env.ODR_MIGRATIONS ?? join(import.meta.dir, "../packages/db/drizzle");

const dir = mkdtempSync(join(tmpdir(), "odr-spike-"));
const client = new PGlite(dir);
const db = drizzle({ client, schema });

const t0 = performance.now();
await migrate(db, { migrationsFolder });
console.log(`migrated in ${Math.round(performance.now() - t0)}ms → ${dir}`);

const [tenant] = await db
  .insert(schema.tenants)
  .values({ slug: "spike", name: "Spike Cafe", country: "IN", currency: "INR" })
  .returning();
const rows = await db.select().from(schema.tenants);
if (rows.length !== 1 || rows[0]!.id !== tenant!.id) throw new Error("round-trip failed");
console.log("round-trip ok, id", tenant!.id);
await client.close();
```

- [ ] **Step 3: Run it under bun**

```bash
bun dev/spike-pglite.ts
```
Expected: `migrated in <n>ms → /tmp/odr-spike-…` then `round-trip ok, id <uuid>`. If `gen_random_uuid` or any migration fails here, stop: PGlite is not usable and the fallback (embedded Postgres binaries) applies. Record and stop the task.

- [ ] **Step 4: Compile for this machine and run**

```bash
mkdir -p /tmp/odr-spike-bin && cp -R packages/db/drizzle /tmp/odr-spike-bin/drizzle
bun build --compile --minify dev/spike-pglite.ts --outfile /tmp/odr-spike-bin/spike
ODR_MIGRATIONS=/tmp/odr-spike-bin/drizzle /tmp/odr-spike-bin/spike
```
Expected: same two lines. Likely failure mode: PGlite cannot locate `pglite.wasm` / `pglite.data` from inside the binary (error mentions `ENOENT` or `fetch` of a `file://` path). If so, apply the documented embed path and re-run:

```ts
// replace `new PGlite(dir)` with:
import wasmPath from "@electric-sql/pglite/dist/pglite.wasm" with { type: "file" };
import dataPath from "@electric-sql/pglite/dist/pglite.data" with { type: "file" };
const client = new PGlite(dir, {
  wasmModule: await WebAssembly.compile(await Bun.file(wasmPath).arrayBuffer()),
  fsBundle: new Blob([await Bun.file(dataPath).arrayBuffer()]),
});
```
Note which variant worked; the Box entry in task 4 uses the same one.

- [ ] **Step 5: Cross-compile for Windows and Linux ARM64 (build only)**

```bash
bun build --compile --target=bun-windows-x64 dev/spike-pglite.ts --outfile /tmp/odr-spike-bin/spike.exe
bun build --compile --target=bun-linux-arm64 dev/spike-pglite.ts --outfile /tmp/odr-spike-bin/spike-arm64
ls -la /tmp/odr-spike-bin/
```
Expected: both files exist. Running them needs the target machine; if a Windows PC or Raspberry Pi is at hand, copy the binary and the `drizzle` folder and run once. Record which targets were executed and which were only built.

- [ ] **Step 6: Record the result in the spec and clean up**

In the spec's Risks section replace the PGlite bullet with the verified outcome, for example:
```
- PGlite in compiled Bun: VERIFIED 2026-09-0X on macOS (arm64) — migrations 11/11, round-trip ok,
  needs the wasmModule/fsBundle embed. Windows x64 and Linux arm64 built; run on hardware pending.
```
Then:
```bash
rm dev/spike-pglite.ts && rm -rf /tmp/odr-spike-bin
```

- [ ] **Step 7: Commit**

```bash
git add packages/db/package.json bun.lock docs/superpowers/specs/2026-09-05-odr-box-offline-design.md
git commit -m "chore: add pglite; record the compile spike result in the box spec"
```

---

### Task 2: PGlite database entry in `packages/db`

**Files:**
- Modify: `packages/db/src/index.ts:1-50`
- Create: `packages/db/src/pglite.ts`
- Create: `packages/db/src/pglite.test.ts`
- Modify: `packages/db/package.json` (exports)

**Interfaces:**
- Produces: `setDb(db: DB): void` in `@odr/db`; `openPglite(folder: string): Promise<{ db: DB; close: () => Promise<void> }>` in `@odr/db/pglite`, which also runs migrations.
- `DB` becomes `PgDatabase<PgQueryResultHKT, typeof schema>` so both drivers satisfy it.

- [ ] **Step 1: Write the failing test**

`packages/db/src/pglite.test.ts`:
```ts
import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openPglite } from "./pglite.ts";
import { tenants } from "./schema/index.ts";

test("openPglite migrates an empty folder and persists across reopen", async () => {
  const dir = mkdtempSync(join(tmpdir(), "odr-pglite-"));
  try {
    const first = await openPglite(dir);
    await first.db.insert(tenants).values({ slug: "t1", name: "T1", country: "IN", currency: "INR" });
    await first.close();

    // Second open: migrations are a no-op, data is still there.
    const second = await openPglite(dir);
    const rows = await second.db.select().from(tenants);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.slug).toBe("t1");
    await second.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
bun test packages/db/src/pglite.test.ts
```
Expected: FAIL — `Cannot find module "./pglite.ts"`.

- [ ] **Step 3: Widen the DB type and add setDb**

In `packages/db/src/index.ts` replace the two lines
```ts
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
…
export type DB = PostgresJsDatabase<typeof schema>;
```
with
```ts
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
…
/** Any Drizzle Postgres database over our schema: postgres.js in the cloud, PGlite in the Box. */
export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;
```
and after `let _db: DB | undefined;` add
```ts
/** An entry point that built its own database (the Box, with PGlite) installs it here. */
export const setDb = (d: DB): void => {
  _db = d;
};
```
Nothing else in the file changes; `real()` already prefers `_db`.

- [ ] **Step 4: Write the PGlite module**

`packages/db/src/pglite.ts` — use the variant that worked in task 1. With the embed variant:
```ts
/*
 * The Box's database: Postgres in-process (PGlite), data in a folder. Only the Box
 * imports this file — the cloud Worker must never pull WASM into its bundle.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { join } from "node:path";
import wasmPath from "@electric-sql/pglite/dist/pglite.wasm" with { type: "file" };
import dataPath from "@electric-sql/pglite/dist/pglite.data" with { type: "file" };
import * as schema from "./schema/index.ts";
import type { DB } from "./index.ts";

/** Migrations ship next to this file in the repo; the compiled Box embeds them (see dev/build-box.ts). */
export const MIGRATIONS = process.env.ODR_MIGRATIONS ?? join(import.meta.dir, "../drizzle");

export const openPglite = async (folder: string): Promise<{ db: DB; close: () => Promise<void> }> => {
  const client = new PGlite(folder, {
    wasmModule: await WebAssembly.compile(await Bun.file(wasmPath).arrayBuffer()),
    fsBundle: new Blob([await Bun.file(dataPath).arrayBuffer()]),
  });
  const db = drizzle({ client, schema }) as unknown as DB;
  await migrate(db as never, { migrationsFolder: MIGRATIONS });
  return { db, close: () => client.close() };
};
```
If task 1 showed plain `new PGlite(folder)` works inside the binary, drop the two `with { type: "file" }` imports and the options object.

Add the export to `packages/db/package.json`:
```json
"exports": {
  ".": "./src/index.ts",
  "./schema": "./src/schema/index.ts",
  "./pglite": "./src/pglite.ts"
}
```

- [ ] **Step 5: Run the test and the whole suite**

```bash
bun test packages/db/src/pglite.test.ts
bun run typecheck && bun test
```
Expected: PASS; all existing tests still pass (the `DB` widening must not break any repo file — if tsc complains about `db.transaction` or `tx.execute` types in a repo, the fix is in that repo's type annotation, not in the schema).

- [ ] **Step 6: Commit**

```bash
git add packages/db
git commit -m "feat(db): pglite entry with migrations for the box; widen DB to any pg driver"
```
(If commitlint rejects the `db` scope, check `commitlint.config.js` for the allowed list and use one from it, or drop the scope.)

---

### Task 3: First-run setup route in the API

**Files:**
- Create: `apps/api/src/modules/admin/setup.ts`
- Create: `apps/api/src/modules/admin/setup.test.ts`
- Modify: `apps/api/src/app.ts:16-30`

**Interfaces:**
- Consumes: `makeAdminService(...).createRestaurant(input)` (exists, `apps/api/src/modules/admin/service.ts:36`) and `AdminRepo.listTenants()`.
- Produces: `buildSetupRoutes(svc: AdminService, repo: AdminRepo): Hono` with `GET /setup → { needed: boolean }` and `POST /setup → 201 { tenantId, outletId }`; `buildApp({ setup?: boolean })`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/modules/admin/setup.test.ts` — the admin repo is Drizzle-only, so use an in-memory stand-in for the two methods the setup needs:
```ts
import { test, expect } from "bun:test";
import { buildSetupRoutes } from "./setup.ts";

const fakeRepo = (tenantCount: () => number) => ({ listTenants: async () => Array(tenantCount()).fill({}) }) as never;

test("setup is open with no tenant, closed once one exists", async () => {
  let count = 0;
  const svc = {
    createRestaurant: async () => {
      count++;
      return { tenantId: "t", outletId: "o", userId: "u", slug: "s", subscriptionStart: "2026-09-05", subscriptionEnd: "2027-09-05" };
    },
  } as never;
  const app = buildSetupRoutes(svc, fakeRepo(() => count));

  expect(await (await app.request("/setup")).json()).toEqual({ needed: true });

  const body = { name: "Zow Cafe", ownerEmail: "a@b.co", ownerPassword: "longenough", ownerFullName: "Admin", gstin: "29ABCDE1234F1Z5" };
  const created = await app.request("/setup", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  expect(created.status).toBe(201);
  expect(await created.json()).toEqual({ tenantId: "t", outletId: "o" });

  expect(await (await app.request("/setup")).json()).toEqual({ needed: false });
  const again = await app.request("/setup", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  expect(again.status).toBe(409);
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
bun test apps/api/src/modules/admin/setup.test.ts
```
Expected: FAIL — `Cannot find module "./setup.ts"`.

- [ ] **Step 3: Write the setup routes**

`apps/api/src/modules/admin/setup.ts`:
```ts
import { Hono } from "hono";
import { z } from "zod";
import { ConflictError, ValidationError } from "@odr/shared";
import type { AdminService } from "./service.ts";
import type { AdminRepo } from "./ports.ts";

/*
 * First run of a Box: no admin console on site, so the owner creates the
 * restaurant here. Open only while the database has no tenant; a 409 after
 * that. Mounted only when buildApp is asked for it (never in the cloud).
 */
const schema = z.object({
  name: z.string().trim().min(1).max(80),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  ownerFullName: z.string().trim().min(1),
  gstin: z.string().trim().length(15).optional(),
});

const today = () => new Date().toISOString().slice(0, 10);

export const buildSetupRoutes = (svc: AdminService, repo: Pick<AdminRepo, "listTenants">) => {
  const r = new Hono();
  const needed = async () => (await repo.listTenants()).length === 0;

  r.get("/setup", async (c) => c.json({ needed: await needed() }));

  r.post("/setup", async (c) => {
    if (!(await needed())) throw new ConflictError("this box is already set up");
    const parsed = schema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("invalid payload", { issues: parsed.error.issues });
    // ponytail: 12 months from today until the license plan replaces this date.
    const res = await svc.createRestaurant({ ...parsed.data, startDate: today(), months: 12 });
    return c.json({ tenantId: res.tenantId, outletId: res.outletId }, 201);
  });
  return r;
};
```
Check `ConflictError` exists in `packages/shared/src/errors.ts` (it does; used by ordering).

- [ ] **Step 4: Mount it from buildApp behind a flag**

In `apps/api/src/app.ts`:
```ts
import { buildSetupRoutes } from "./modules/admin/setup.ts";
import { drizzleAdminRepo } from "./modules/admin/repo.drizzle.ts";
…
export const buildApp = async (opts: { setup?: boolean } = {}) => {
  …
  const admin = adminModule({ db, menu: menu.service });
  app.route("/admin", admin.routes);
  // Box only: first-run restaurant creation, no auth, closes itself after the first tenant.
  if (opts.setup) app.route("/", buildSetupRoutes(admin.service, drizzleAdminRepo(db)));
```
(Replace the existing `app.route("/admin", adminModule({ db, menu: menu.service }).routes);` line with the two lines above.)

- [ ] **Step 5: Run tests and typecheck**

```bash
bun test apps/api/src/modules/admin && bun run typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/admin/setup.ts apps/api/src/modules/admin/setup.test.ts apps/api/src/app.ts
git commit -m "feat: first-run setup route, mounted only for the box"
```

---

### Task 4: Fonts bundled, offline flag, QR hidden offline

**Files:**
- Modify: `apps/captain-pwa/package.json`, `apps/captain-pwa/src/index.html:41-50`, `apps/captain-pwa/src/index.css:12-16`
- Create: `apps/captain-pwa/src/lib/config.ts`
- Modify: `apps/captain-pwa/src/features/qr/qr-image.tsx:10-17`, `apps/captain-pwa/src/routes/more.tsx:88-96`, `apps/captain-pwa/src/routes/settings.tsx:210`, `apps/captain-pwa/src/app.tsx` (qr route line), `apps/captain-pwa/src/main.tsx:35-38`

**Interfaces:**
- Produces: `config()` returning `{ dinerOrigin: string; offline: boolean }` from `lib/config.ts`. `window.__ODR` may carry `offline?: boolean`.

- [ ] **Step 1: Bundle the fonts**

```bash
bun add --cwd apps/captain-pwa @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono
```
In `apps/captain-pwa/src/index.css`, after `@import "@odr/ui/theme";` add:
```css
/* Bundled: the Box has no internet, and the cloud stops depending on Google Fonts too. */
@import "@fontsource/ibm-plex-sans/400.css";
@import "@fontsource/ibm-plex-sans/500.css";
@import "@fontsource/ibm-plex-sans/600.css";
@import "@fontsource/ibm-plex-mono/400.css";
@import "@fontsource/ibm-plex-mono/500.css";
@import "@fontsource/ibm-plex-mono/600.css";
```
In `apps/captain-pwa/src/index.html` delete the two `<link rel="preconnect" …>` lines, the comment above the stylesheet link, and the `<link rel="stylesheet" href="https://fonts.googleapis.com/…" media="print" onload=…>` element (lines 41–50 today).

- [ ] **Step 2: Build and check the fonts are in dist**

```bash
DINER_ORIGIN=https://odr-diner.zowcode.workers.dev bun run build:captain && ls apps/captain-pwa/dist | grep -c woff2 && grep -c 'googleapis' apps/captain-pwa/dist/index.html
```
Expected: a count of at least 6 `.woff2` files (fontsource ships latin subsets per weight; more is fine), and `0` for googleapis. If the count is 0, Bun's CSS bundler did not copy `url()` assets: switch the `@import`s to `@import url("…")` inside `index.css` is not the fix — instead import the six CSS files from `main.tsx` (`import "@fontsource/ibm-plex-sans/400.css";` …) so the JS bundler owns them, and rebuild.

- [ ] **Step 3: Add the config helper and the offline flag**

`apps/captain-pwa/src/lib/config.ts`:
```ts
/* Server-supplied runtime config. Cloud: { dinerOrigin }. Box: { dinerOrigin: "", offline: true }. */
declare global {
  interface Window {
    __ODR?: { dinerOrigin?: string; offline?: boolean };
  }
}

export const config = () => ({
  dinerOrigin: window.__ODR?.dinerOrigin ?? "",
  /** No internet on this install: hide anything that needs a customer's phone to reach us. */
  offline: window.__ODR?.offline === true,
});
```
In `apps/captain-pwa/src/features/qr/qr-image.tsx` delete the `declare global { interface Window { __ODR?: … } }` block and change the origin helper to:
```ts
import { config } from "../../lib/config.ts";
const dinerOrigin = (): string =>
  config().dinerOrigin || window.location.origin.replace(/:\d+$/, ":3003");
```
In `apps/captain-pwa/src/main.tsx` change the fetch type to `Promise<{ dinerOrigin?: string; offline?: boolean }>`.

- [ ] **Step 4: Hide the QR surfaces when offline**

`apps/captain-pwa/src/routes/more.tsx`: wrap the "Print QR sheet" `<Row …/>` (the one navigating to `{ name: "qr" }`) in `{!config().offline ? ( … ) : null}` and add `import { config } from "../lib/config.ts";`.

`apps/captain-pwa/src/routes/settings.tsx` line 210: `<QrSection session={session} q={tablesQ} />` becomes `{config().offline ? null : <QrSection session={session} q={tablesQ} />}` with the same import.

`apps/captain-pwa/src/app.tsx`: the line rendering `QrSheetRoute` becomes
```tsx
{route.name === "qr" && !config().offline ? <QrSheetRoute session={session} /> : null}
```
with the import added.

- [ ] **Step 5: Typecheck, build, and check the cloud build is unchanged in behaviour**

```bash
bun run typecheck && DINER_ORIGIN=https://odr-diner.zowcode.workers.dev bun run build:captain
```
Expected: clean. Open `apps/captain-pwa/dist/index.html` and confirm `window.__ODR={"dinerOrigin":"https://odr-diner…"}` is still inlined (no `offline` key, so the cloud shows QR as before).

- [ ] **Step 6: Commit**

```bash
git add apps/captain-pwa bun.lock
git commit -m "feat: bundle fonts; offline flag hides diner qr surfaces"
```

---

### Task 5: Setup screen in the captain app

**Files:**
- Modify: `apps/captain-pwa/src/lib/api.ts` (near `login`)
- Create: `apps/captain-pwa/src/routes/setup.tsx`
- Modify: `apps/captain-pwa/src/routes/login.tsx:60-70,150-175`

**Interfaces:**
- Consumes: `GET /setup`, `POST /setup` from task 3.
- Produces: `api.setupStatus(): Promise<{ needed: boolean }>` (resolves `{ needed: false }` on 404 so the cloud never shows the form); `api.setup(input)`; `<SetupRoute onDone={(email, password) => void} />`.

- [ ] **Step 1: API client calls**

In `apps/captain-pwa/src/lib/api.ts`, next to `login:` add:
```ts
  /** Box only. The cloud has no /setup and 404s → { needed: false }. */
  setupStatus: () =>
    get<{ needed: boolean }>("/setup").catch((e: unknown) =>
      e instanceof ApiError && e.status === 404 ? { needed: false } : Promise.reject(e),
    ),
  setup: (input: { name: string; ownerEmail: string; ownerPassword: string; ownerFullName: string; gstin?: string }) =>
    send<{ tenantId: string; outletId: string }>("POST", "/setup", input),
```

- [ ] **Step 2: The setup form**

`apps/captain-pwa/src/routes/setup.tsx`:
```tsx
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Input } from "@odr/ui";
import { api } from "../lib/api.ts";

/** First run of a Box: create the restaurant and its owner. Tables come later, in Settings. */
export const SetupRoute = ({ onDone }: { onDone: (email: string, password: string) => void }) => {
  const [f, setF] = useState({ name: "", gstin: "", ownerFullName: "", ownerEmail: "", ownerPassword: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.setup({
        name: f.name.trim(),
        ownerFullName: f.ownerFullName.trim(),
        ownerEmail: f.ownerEmail.trim(),
        ownerPassword: f.ownerPassword,
        ...(f.gstin.trim() ? { gstin: f.gstin.trim().toUpperCase() } : {}),
      });
      onDone(f.ownerEmail.trim(), f.ownerPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, node: React.ReactNode) => (
    <label className="block">
      <span className="block text-[13px] font-medium text-[var(--fg-secondary)] mb-1.5">{label}</span>
      {node}
    </label>
  );

  return (
    <form onSubmit={submit} className="w-full max-w-[340px] mx-auto my-auto py-10 space-y-4">
      <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Set up this restaurant</h2>
      <p className="text-[13px] text-[var(--fg-tertiary)]">Done once, on this machine. You can add tables and staff in Settings afterwards.</p>
      {field("Restaurant name", <Input required value={f.name} onChange={set("name")} className="h-11" />)}
      {field("GSTIN (optional)", <Input value={f.gstin} onChange={set("gstin")} maxLength={15} placeholder="29ABCDE1234F1Z5" className="h-11 font-mono uppercase" />)}
      {field("Your name", <Input required value={f.ownerFullName} onChange={set("ownerFullName")} className="h-11" />)}
      {field("Your email", <Input required type="email" value={f.ownerEmail} onChange={set("ownerEmail")} className="h-11" />)}
      {field("Password (8+ characters)", <Input required type="password" minLength={8} value={f.ownerPassword} onChange={set("ownerPassword")} className="h-11" />)}
      {error ? <p className="text-[13px] text-[var(--status-voided)]">{error}</p> : null}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : null} Create and sign in
      </Button>
    </form>
  );
};
```

- [ ] **Step 3: Show it from the login screen**

In `apps/captain-pwa/src/routes/login.tsx`:
- add `import { SetupRoute } from "./setup.tsx";`
- inside `LoginRoute`, after the existing `useState` lines add:
```tsx
  const [setupNeeded, setSetupNeeded] = useState(false);
  useEffect(() => {
    void api.setupStatus().then((s) => setSetupNeeded(s.needed)).catch(() => undefined);
  }, []);
```
- change `const signIn = async (tenantId?: string) => {` so it can be called with credentials: replace `const res = await api.login(email.trim(), password, tenantId);` with
```tsx
      const res = await api.login((creds?.email ?? email).trim(), creds?.password ?? password, tenantId);
```
and the signature with `const signIn = async (tenantId?: string, creds?: { email: string; password: string }) => {`. Every existing call `signIn()` / `signIn(t.id)` keeps working.
- in the right-hand `<section>`, where the JSX starts `{tenants ? (`, prepend a branch:
```tsx
        {setupNeeded ? (
          <SetupRoute
            onDone={(e, p) => {
              setSetupNeeded(false);
              setEmail(e);
              setPassword(p);
              void signIn(undefined, { email: e, password: p });
            }}
          />
        ) : tenants ? (
```
(the closing of the ternary chain gains nothing: `tenants ? … : outlets ? … : <form…>` already ends the chain; only the leading branch is new).

- [ ] **Step 4: Typecheck and build**

```bash
bun run typecheck && DINER_ORIGIN=https://odr-diner.zowcode.workers.dev bun run build:captain
```
Expected: clean.

- [ ] **Step 5: Manual check against the cloud API (dev)**

```bash
bun run dev:api & sleep 2; curl -s localhost:3000/setup -o /dev/null -w '%{http_code}\n'; kill %1
```
Expected: `404` — the cloud/dev API does not mount setup, so the login screen behaves exactly as before.

- [ ] **Step 6: Commit**

```bash
git add apps/captain-pwa/src/lib/api.ts apps/captain-pwa/src/routes/setup.tsx apps/captain-pwa/src/routes/login.tsx
git commit -m "feat: first-run setup screen shown when the api reports setup is needed"
```

---

### Task 6: The Box entry point and its test

**Files:**
- Create: `apps/box/package.json`, `apps/box/src/main.ts`, `apps/box/src/serve.ts`, `apps/box/src/box.test.ts`
- Create (placeholder, overwritten by the build): `apps/box/src/assets.gen.ts`

**Interfaces:**
- Consumes: `openPglite(folder)` and `setDb(db)` from task 2; `buildApp({ setup: true })` from task 3.
- Produces: `startBox(opts: { dataDir: string; port: number; assets: Record<string, string> }): Promise<{ url: string; stop: () => Promise<void> }>` in `serve.ts`; `main.ts` is the compiled entry that reads env/config and calls it.

- [ ] **Step 1: Package file**

`apps/box/package.json`:
```json
{
  "name": "@odr/box",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "ODR_DATA=./.data bun --hot ./src/main.ts"
  },
  "dependencies": {
    "@odr/api": "workspace:*",
    "@odr/db": "workspace:*"
  }
}
```
`apps/api/package.json` has no `exports`; add `"exports": { "./app": "./src/app.ts" }` so the Box can import `@odr/api/app`. Run `bun install` afterwards.

- [ ] **Step 2: Placeholder assets module**

`apps/box/src/assets.gen.ts` (committed once as empty; `dev/build-box.ts` regenerates it):
```ts
// GENERATED by dev/build-box.ts — do not edit. Maps URL path → embedded file path.
export const assets: Record<string, string> = {};
```

- [ ] **Step 3: Write the failing test**

`apps/box/src/box.test.ts`:
```ts
import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBox } from "./serve.ts";

test("box boots on an empty folder, sets up a restaurant, owner signs in", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "odr-box-"));
  const box = await startBox({ dataDir, port: 0, assets: {} });
  try {
    const cfg = await (await fetch(`${box.url}/config.json`)).json();
    expect(cfg).toEqual({ dinerOrigin: "", offline: true });

    expect(await (await fetch(`${box.url}/setup`)).json()).toEqual({ needed: true });

    const created = await fetch(`${box.url}/setup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Box Cafe", ownerEmail: "o@box.test", ownerPassword: "password1", ownerFullName: "Owner" }),
    });
    expect(created.status).toBe(201);

    const login = await fetch(`${box.url}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "o@box.test", password: "password1" }),
    });
    expect(login.status).toBe(200);
    const { token } = (await login.json()) as { token: string };

    const outlets = await fetch(`${box.url}/api/v1/outlets`, { headers: { authorization: `Bearer ${token}` } });
    expect(((await outlets.json()) as { outlets: unknown[] }).outlets).toHaveLength(1);
  } finally {
    await box.stop();
    rmSync(dataDir, { recursive: true, force: true });
  }
}, 30_000);
```
Check the login route path and body shape in `apps/api/src/modules/identity/routes.ts` before running (the file is open in the IDE); adjust `/auth/login` and the JSON keys if they differ.

- [ ] **Step 4: Run it to verify it fails**

```bash
bun test apps/box
```
Expected: FAIL — `Cannot find module "./serve.ts"`.

- [ ] **Step 5: The server module**

`apps/box/src/serve.ts`:
```ts
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setDb } from "@odr/db";
import { openPglite } from "@odr/db/pglite";

/*
 * Everything the Box serves, on one port: the API, the staff app, runtime config.
 * `assets` maps a URL path ("/index.html", "/chunk-abc.js") to a file path the
 * compiled binary can Bun.file(); dev passes {} and proxies to the captain dev server.
 */
export const startBox = async (opts: { dataDir: string; port: number; assets: Record<string, string> }) => {
  mkdirSync(opts.dataDir, { recursive: true });

  // A per-install JWT secret, generated once. auth/tokens reads process.env at import,
  // so this must be set before the API module loads (hence the dynamic import below).
  const secretFile = join(opts.dataDir, "secret");
  if (!existsSync(secretFile)) writeFileSync(secretFile, crypto.randomUUID() + crypto.randomUUID(), { mode: 0o600 });
  process.env.JWT_SECRET ??= readFileSync(secretFile, "utf8").trim();

  const pg = await openPglite(join(opts.dataDir, "db"));
  setDb(pg.db);

  const { buildApp } = await import("@odr/api/app");
  const app = await buildApp({ setup: true });

  const config = JSON.stringify({ dinerOrigin: "", offline: true });
  const index = opts.assets["/index.html"];

  const server = Bun.serve({
    port: opts.port,
    async fetch(req) {
      const url = new URL(req.url);
      const p = url.pathname;
      if (p.startsWith("/api/") || p.startsWith("/auth/") || p.startsWith("/public/") || p === "/health" || p === "/setup") {
        return app.fetch(req);
      }
      if (p === "/config.json") return new Response(config, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
      const file = opts.assets[p];
      if (file) return new Response(Bun.file(file));
      // Hash router: every other path is the app shell.
      if (index) return new Response(Bun.file(index), { headers: { "content-type": "text/html; charset=utf-8" } });
      return new Response("not found", { status: 404 });
    },
  });

  return {
    url: `http://localhost:${server.port}`,
    stop: async () => {
      await server.stop(true);
      await pg.close();
    },
  };
};
```

- [ ] **Step 6: The compiled entry**

`apps/box/src/main.ts`:
```ts
import { homedir } from "node:os";
import { join } from "node:path";
import { assets } from "./assets.gen.ts";
import { startBox } from "./serve.ts";

// Data folder the owner can find: ~/Odr (Windows: C:\Users\<name>\Odr). ODR_DATA overrides.
const dataDir = process.env.ODR_DATA ?? join(homedir(), "Odr");
const port = Number(process.env.ODR_PORT ?? 3000);

const box = await startBox({ dataDir, port, assets });
console.log(`Odr Box · data in ${dataDir} · open ${box.url} on any phone on this wifi`);
```

- [ ] **Step 7: Run the test**

```bash
bun install && bun test apps/box && bun run typecheck
```
Expected: PASS within a few seconds (first PGlite start compiles WASM; the 30 s timeout is generous).

- [ ] **Step 8: Commit**

```bash
git add apps/box apps/api/package.json bun.lock
git commit -m "feat: box entry serves the api and staff app on one port over pglite"
```

---

### Task 7: Build script that produces the executable

**Files:**
- Create: `dev/build-box.ts`
- Modify: `package.json` (root scripts)

**Interfaces:**
- Produces: `bun run build:box [target]` → `apps/box/dist/odr-box-<target>[.exe]`, and a regenerated `apps/box/src/assets.gen.ts`.

- [ ] **Step 1: Write the build script**

`dev/build-box.ts`:
```ts
/*
 * One executable per platform: the API, the staff app and the migrations inside.
 *
 *   bun dev/build-box.ts                 → this machine
 *   bun dev/build-box.ts bun-windows-x64 → cross-compile (also bun-linux-x64, bun-linux-arm64,
 *                                          bun-darwin-x64, bun-darwin-arm64)
 */
import { readdirSync, statSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dir, "..");
const target = process.argv[2] ?? "";
const dist = join(root, "apps/captain-pwa/dist");

// 1. The staff app, built for the Box (no diner origin — QR is hidden offline anyway).
const web = Bun.spawnSync(["bun", "dev/build-web.ts", "captain-pwa"], { cwd: root, env: { ...process.env, DINER_ORIGIN: "" }, stdout: "inherit", stderr: "inherit" });
if (web.exitCode !== 0) process.exit(web.exitCode);

// 2. One `with { type: "file" }` import per built file, so `bun build --compile` embeds them.
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const files = walk(dist).filter((f) => !f.includes("/docs/")); // the /docs pages are cloud-only
const lines = ["// GENERATED by dev/build-box.ts — do not edit. Maps URL path → embedded file path."];
const entries: string[] = [];
files.forEach((f, i) => {
  const url = "/" + relative(dist, f).split("\\").join("/");
  lines.push(`import a${i} from ${JSON.stringify("../../captain-pwa/dist/" + relative(dist, f))} with { type: "file" };`);
  entries.push(`  ${JSON.stringify(url)}: a${i},`);
});
lines.push("export const assets: Record<string, string> = {", ...entries, "};");
await Bun.write(join(root, "apps/box/src/assets.gen.ts"), lines.join("\n") + "\n");

// 3. Migrations travel inside the binary too: import each .sql and the journal as files,
//    and point ODR_MIGRATIONS at their embedded folder at runtime.
//    ponytail: drizzle's migrator reads a folder, so main.ts copies the embedded files to
//    <data>/migrations on start — see step 2 below.

// 4. Compile.
mkdirSync(join(root, "apps/box/dist"), { recursive: true });
const ext = target.includes("windows") ? ".exe" : "";
const out = join(root, `apps/box/dist/odr-box-${target || "host"}${ext}`);
const args = ["bun", "build", "--compile", "--minify", ...(target ? [`--target=${target}`] : []), "apps/box/src/main.ts", "--outfile", out];
if (target.includes("windows")) args.push("--windows-hide-console");
const build = Bun.spawnSync(args, { cwd: root, stdout: "inherit", stderr: "inherit" });
if (build.exitCode !== 0) process.exit(build.exitCode);
console.log(`▸ ${relative(root, out)} (${(statSync(out).size / 1e6).toFixed(1)} MB)`);
```

- [ ] **Step 2: Embed the migrations**

Drizzle's migrator reads a folder from disk, so the compiled Box carries the migration files as embedded assets and writes them to `<data>/migrations` before opening the database. Extend the generator in `dev/build-box.ts` step 2 to also walk `packages/db/drizzle` (the `.sql` files and `meta/_journal.json`; skip `meta/*_snapshot.json`, they are 2 MB each and the migrator does not read them) into a second map `migrations`, emitted in the same `assets.gen.ts`:
```ts
export const migrations: Record<string, string> = { "0000_x.sql": a99, "meta/_journal.json": a100, … };
```
Then in `apps/box/src/serve.ts`, before `openPglite`, add:
```ts
import { migrations } from "./assets.gen.ts";
…
  // Compiled binary: unpack the embedded migration files so drizzle's folder-based migrator can read them.
  if (Object.keys(migrations).length) {
    const dir = join(opts.dataDir, "migrations");
    mkdirSync(join(dir, "meta"), { recursive: true });
    for (const [rel, src] of Object.entries(migrations)) await Bun.write(join(dir, rel), Bun.file(src));
    process.env.ODR_MIGRATIONS = dir;
  }
```
and give the placeholder `assets.gen.ts` an empty `export const migrations: Record<string, string> = {};` too. `packages/db/src/pglite.ts` already reads `ODR_MIGRATIONS` first.

- [ ] **Step 3: Root script and .gitignore**

In root `package.json` scripts add `"build:box": "bun dev/build-box.ts"`. Add `apps/box/dist/` and `apps/box/.data/` to `.gitignore`.

- [ ] **Step 4: Build for this machine and run it end to end**

```bash
bun run build:box
ODR_DATA=/tmp/odr-box-data ODR_PORT=3010 ./apps/box/dist/odr-box-host &
sleep 3
curl -s localhost:3010/config.json; echo
curl -s localhost:3010/setup; echo
curl -s -o /dev/null -w '%{http_code}\n' localhost:3010/
curl -s localhost:3010/ | grep -o 'chunk-[a-z0-9]*\.js' | head -1 | xargs -I{} curl -s -o /dev/null -w 'chunk %{http_code}\n' localhost:3010/{}
curl -s localhost:3010/ | grep -o '[a-z0-9-]*\.woff2' | head -1 | xargs -I{} curl -s -o /dev/null -w 'font %{http_code}\n' localhost:3010/{}
kill %1; rm -rf /tmp/odr-box-data
```
Expected: `{"dinerOrigin":"","offline":true}`, `{"needed":true}`, `200`, `chunk 200`, `font 200`. Then open `http://localhost:3010` in a browser once, complete the setup form, sign in, add a table in Settings, open it, fire a KOT, settle and print a bill (browser print). Confirm the More screen has no "Print QR sheet" row and Settings has no QR section.

- [ ] **Step 5: Cross-compile the other targets (build only)**

```bash
for t in bun-windows-x64 bun-linux-x64 bun-linux-arm64; do bun run build:box $t; done
ls -la apps/box/dist
```
Expected: four files. Sizes will be roughly 60–100 MB each (Bun runtime plus PGlite WASM). Note them in the commit message body if surprising.

- [ ] **Step 6: Commit**

```bash
git add dev/build-box.ts package.json .gitignore apps/box/src/assets.gen.ts apps/box/src/serve.ts
git commit -m "feat: build:box compiles the api, staff app and migrations into one executable"
```
(`assets.gen.ts` is committed in its generated form so the tests and typecheck see real types; the build rewrites it each time.)

---

### Task 8: Run on the pilot hardware and record

**Files:**
- Modify: `docs/superpowers/specs/2026-09-05-odr-box-offline-design.md` (Risks and Plan of work)

- [ ] **Step 1: Windows**

Copy `apps/box/dist/odr-box-bun-windows-x64.exe` to a Windows PC. Double-click. Accept the firewall prompt. Note the address printed (or, with the console hidden, open `http://localhost:3000`). From a phone on the same wifi open `http://<pc-ip>:3000`. Complete setup, add tables, fire a KOT, settle, browser-print a bill. If a LAN thermal printer is available, set its IP in Settings → Printing and use "Print to kitchen printer".

- [ ] **Step 2: Linux ARM64 (if a Raspberry Pi is available)**

```bash
scp apps/box/dist/odr-box-bun-linux-arm64 pi@<ip>:~/odr-box && ssh pi@<ip> 'chmod +x ~/odr-box && ~/odr-box'
```
Same walk-through from a phone.

- [ ] **Step 3: Record**

Update the spec: PGlite bullet under Risks with the platforms actually exercised, and tick items 1–4 of the Plan of work. Commit:
```bash
git add docs/superpowers/specs/2026-09-05-odr-box-offline-design.md
git commit -m "docs: box foundation verified on pilot hardware"
```

---

## Self-review

**Spec coverage (components 1–3 and the two rules):**
- §1 Database entry → Task 2 (`ODR_DB` from the spec became `setDb()` + `openPglite()`; the entry point decides, which is cleaner than parsing a URL scheme in the db package. Update the spec wording when task 2 lands.)
- §2 Box entry point → Tasks 6 and 7 (config served with `offline: true`, SPA fallback, one port, migrations on start).
- §3 First-run setup → Tasks 3 and 5. Tables are added in Settings afterwards, as the setup copy says; the spec listed tables in the form — dropped, one fewer step, existing screen does it.
- Hidden features → Task 4 (QR). "Bills on the device" hidden by never setting the flag; no code.
- Fonts → Task 4.
- §4–§9 → next two plans; the license plan must replace the 12-month default in `setup.ts`.

**Placeholder scan:** none. Every code step has the code; the two "adjust if different" notes point at a specific file to read.

**Type consistency:** `startBox({ dataDir, port, assets })` in tasks 6 and 7; `assets`/`migrations` exports in `assets.gen.ts` used by `serve.ts` and `main.ts`; `openPglite(folder)` returning `{ db, close }` in tasks 2 and 6; `buildApp({ setup })` in tasks 3 and 6; `config()` in task 4 only.
