# Odr Box Licensing and Boxes Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Our sales team registers and renews Boxes from the admin console by issuing signed license keys; a Box accepts a key offline, bound to its own install id, and shows version, install id and expiry in an About tab.

**Architecture:** Ed25519-signed compact tokens (`jose`, already a dependency of `@odr/auth`) carry install id, license id, plan and expiry. The public key ships inside every Box build; the private key is a Cloudflare secret used only by the admin API. On the Box, a key is verified locally and written into the existing `tenants.subscription_end` gate (plus 3 days grace), so nothing in the subscription enforcement changes. The cloud gains two tables (`boxes`, `box_licenses`), admin routes, a Boxes tab, and a public check-in route that Boxes call only when they happen to be online.

**Tech Stack:** Bun 1.3, Hono, Drizzle 0.45 (postgres.js in the cloud, PGlite on the Box), `jose` EdDSA, React (captain PWA and admin console), `qrcode`.

**Spec:** `docs/superpowers/specs/2026-09-05-odr-box-offline-design.md` — this plan implements component 4 (license, Boxes panel, check-in) and the version stamp from component 6. Updates with binary download and rollback (component 5) and backup/installers (7–9) are later plans.

## Global Constraints

- One codebase. Only entry points (`apps/box`, `apps/api/src/worker.ts`) and `packages/db` may know cloud-vs-Box; the Box tells `buildApp` what it needs through options (spec §10).
- The private license key never enters a build, a client bundle, or git. It lives in `LICENSE_PRIVATE_KEY` (Cloudflare secret and local `.env`); tests generate ephemeral keypairs.
- A key is accepted only if its signature verifies AND its install id equals this Box's install id (spec §4). Wrong key → 403, never a partial write.
- Grace is exactly 3 days: `subscription_end = licenseExpiry + 3 days`; About shows the license expiry itself. First run without a key: `today + 14 days` (spec §4, replaces the plan-1 12-month default).
- Migrations are append-only; the new migration is generated with drizzle-kit and applied by the user with `bun run db:migrate` (never from an agent against `.env`).
- Cloud behaviour for existing tenants is unchanged: the new routes are additive; the Boxes tab is a new tab, the Restaurants tab is untouched.
- Every user-facing change ships with its docs in the same commit (repo `CLAUDE.md`): the handbook gains a license section and its PDF is regenerated; the internal guides `docs/deploy/box-testing.md` and a new `docs/deploy/box-sales.md` are updated.
- Work on branch `box`. Commits: conventional prefix, lower-case subject, under 100 characters, no trailers. `bun run typecheck && bun test` green before every commit.
- Ponytail: shortest working diff; deliberate shortcuts carry a `// ponytail:` comment naming the ceiling.

---

## File structure

| File | Responsibility |
|---|---|
| `package.json` (modify) | Single `version` field, stamped into both builds. |
| `dev/build-web.ts`, `dev/build-box.ts` (modify) | Pass the version as `process.env.ODR_VERSION`. |
| `packages/auth/src/license.ts` (create) | `signLicense`, `verifyLicense`, claim types. `packages/auth/src/license.test.ts`. |
| `packages/auth/src/license-public.ts` (create) | The public JWK constant (replaced once with the real key). |
| `dev/license-keygen.ts` (create) | One-off: prints a fresh Ed25519 keypair as JWKs. |
| `apps/box/src/serve.ts` (modify) | Install id file, stored license file, `/box/info`, passes `box` options into `buildApp`, daily check-in. `apps/box/src/box.test.ts` (modify). |
| `apps/api/src/app.ts` (modify) | `buildApp({ box?: { installId, setupCode, onLicense } })`. |
| `apps/api/src/modules/admin/setup.ts` (modify) | 14-day first run. |
| `apps/api/src/modules/admin/box-license.ts` (create) | `POST /box/license` on the Box: verify, bind, write `subscription_end`. `box-license.test.ts`. |
| `packages/db/src/schema/boxes.ts` (create) + `packages/db/drizzle/0012_*.sql` (generated) | Cloud tables `boxes`, `box_licenses`. |
| `apps/api/src/modules/boxes/{ports,repo.drizzle,repo.memory,service,routes,module}.ts` (create) | Admin routes to register/renew/list Boxes and sign keys; public check-in. `boxes.test.ts`. |
| `apps/admin/src/api.ts`, `apps/admin/src/boxes.tsx` (create), `apps/admin/src/app.tsx` (modify) | Boxes tab. |
| `apps/captain-pwa/src/lib/api.ts` (modify) | `boxInfo()`, `applyLicense(key)`. |
| `apps/captain-pwa/src/routes/settings.tsx` (modify), `apps/captain-pwa/src/routes/about.tsx` (create) | About tab (offline only). |
| `apps/captain-pwa/src/shell/subscription.tsx` (modify) | Key entry on the ended screen (offline only). |
| `apps/captain-pwa/src/routes/setup.tsx`, `login.tsx` (modify) | Install id shown during setup; version in the footer. |
| `docs/handbook/odr-handbook.html` + PDF, `docs/deploy/box-testing.md`, `docs/deploy/box-sales.md` (create) | Docs. |

---

### Task 1: One version number, stamped into both builds, shown on the login screen

**Files:**
- Modify: `package.json` (root), `dev/build-web.ts:25-35`, `dev/build-box.ts:62`, `apps/captain-pwa/src/routes/login.tsx:159-161`, `apps/captain-pwa/src/lib/config.ts`

**Interfaces:**
- Produces: `config().version: string` in the PWA; `process.env.ODR_VERSION` in the Box binary (read in Task 3 for `/box/info`).

- [ ] **Step 1: Version field**

In the root `package.json`, after `"private": true,` add `"version": "1.1.0",`.

- [ ] **Step 2: Stamp it into the web build**

In `dev/build-web.ts`, before `Bun.build`, read the version and add it to `define`:
```ts
const version = (JSON.parse(await Bun.file(`${import.meta.dir}/../package.json`).text()) as { version: string }).version;
…
  define: { "process.env.NODE_ENV": JSON.stringify("production"), "process.env.ODR_VERSION": JSON.stringify(version) },
```

- [ ] **Step 3: Stamp it into the Box binary**

In `dev/build-box.ts`, read the version the same way and add to `args` before `"apps/box/src/main.ts"`:
```ts
`--define=process.env.ODR_VERSION=${JSON.stringify(JSON.stringify(version))}`,
```
(Bun's `--define` takes a JS expression; the double stringify yields `"1.1.0"` with quotes.)

- [ ] **Step 4: Expose it in the PWA**

`apps/captain-pwa/src/lib/config.ts` — add to the returned object:
```ts
  /** Stamped by the build; "dev" under the dev server. */
  version: process.env.ODR_VERSION ?? "dev",
```
In `apps/captain-pwa/src/routes/login.tsx` replace the footer line `v1.0 · FY 2026–27 · Made in Mangaluru` with `` {`v${config().version} · FY 2026–27 · Made in Mangaluru`} `` and import `config`.

- [ ] **Step 5: Verify**

```bash
bun run typecheck && DINER_ORIGIN=https://odr-diner.zowcode.workers.dev bun run build:captain && grep -o 'v1\.1\.0' apps/captain-pwa/dist/chunk-*.js | head -1
```
Expected: `v1.1.0`. Then `bun run build:box` and `strings apps/box/dist/odr-box-host | grep -c '"1.1.0"'` → at least 1.

- [ ] **Step 6: Commit**

```bash
git add package.json dev/build-web.ts dev/build-box.ts apps/captain-pwa/src/lib/config.ts apps/captain-pwa/src/routes/login.tsx apps/box/src/assets.gen.ts
git commit -m "feat: one version number stamped into the web and box builds"
```

---

### Task 2: License tokens in `@odr/auth`

**Files:**
- Create: `packages/auth/src/license.ts`, `packages/auth/src/license-public.ts`, `packages/auth/src/license.test.ts`, `dev/license-keygen.ts`
- Modify: `packages/auth/src/index.ts` (export)

**Interfaces:**
- Produces:
  ```ts
  type LicenseClaims = { installId: string; licenseId: string; name: string; plan: string; expiresAt: string /* YYYY-MM-DD */ };
  signLicense(claims: LicenseClaims, privateJwk: JsonWebKey): Promise<string>;
  verifyLicense(token: string, publicJwk: JsonWebKey): Promise<LicenseClaims>; // throws on bad signature/shape
  LICENSE_PUBLIC_JWK: JsonWebKey;
  ```

- [ ] **Step 1: Failing test**

`packages/auth/src/license.test.ts`:
```ts
import { test, expect } from "bun:test";
import { exportJWK, generateKeyPair } from "jose";
import { signLicense, verifyLicense } from "./license.ts";

const claims = { installId: "11111111-1111-1111-1111-111111111111", licenseId: "L-1", name: "Zow Cafe", plan: "yearly", expiresAt: "2027-09-05" };

test("a signed license verifies and round-trips its claims", async () => {
  const { privateKey, publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const token = await signLicense(claims, await exportJWK(privateKey));
  expect(await verifyLicense(token, await exportJWK(publicKey))).toEqual(claims);
});

test("a license signed by someone else is refused", async () => {
  const ours = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const theirs = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const token = await signLicense(claims, await exportJWK(theirs.privateKey));
  await expect(verifyLicense(token, await exportJWK(ours.publicKey))).rejects.toThrow();
});

test("a tampered payload is refused", async () => {
  const { privateKey, publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const token = await signLicense(claims, await exportJWK(privateKey));
  const [h, p, s] = token.split(".") as [string, string, string];
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), exp: "2099-01-01" })).toString("base64url");
  await expect(verifyLicense(`${h}.${forged}.${s}`, await exportJWK(publicKey))).rejects.toThrow();
});
```

- [ ] **Step 2: Run to see it fail**

`bun test packages/auth/src/license.test.ts` → FAIL, cannot find `./license.ts`.

- [ ] **Step 3: Implement**

`packages/auth/src/license.ts`:
```ts
import { SignJWT, importJWK, jwtVerify } from "jose";

/**
 * A Box license: who it is for (install id), what it grants, until when.
 * Ed25519 so the verifying key can ship inside every Box binary while the
 * signing key stays with us. The date is a plain YYYY-MM-DD, the same shape
 * as tenants.subscription_end.
 */
export type LicenseClaims = {
  installId: string;
  licenseId: string;
  name: string;
  plan: string;
  expiresAt: string;
};

const ISSUER = "odr-license";

export const signLicense = async (c: LicenseClaims, privateJwk: JsonWebKey): Promise<string> =>
  new SignJWT({ lid: c.licenseId, name: c.name, plan: c.plan, expiresAt: c.expiresAt })
    .setProtectedHeader({ alg: "EdDSA" })
    .setIssuer(ISSUER)
    .setSubject(c.installId)
    .setIssuedAt()
    .sign(await importJWK(privateJwk, "EdDSA"));

export const verifyLicense = async (token: string, publicJwk: JsonWebKey): Promise<LicenseClaims> => {
  const { payload } = await jwtVerify(token, await importJWK(publicJwk, "EdDSA"), { issuer: ISSUER });
  const { sub, lid, name, plan, expiresAt } = payload as Record<string, unknown>;
  if (typeof sub !== "string" || typeof lid !== "string" || typeof name !== "string" || typeof plan !== "string" || typeof expiresAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) {
    throw new Error("license is missing fields");
  }
  return { installId: sub, licenseId: lid, name, plan, expiresAt };
};
```
Note: no `exp` claim on purpose — a key past its date must still verify so About can say "expired on …"; expiry is enforced by `subscription_end`, not by the token.

`packages/auth/src/license-public.ts`:
```ts
/** The verifying half of our license keypair. Replace once, with the output of `bun dev/license-keygen.ts`. */
export const LICENSE_PUBLIC_JWK: JsonWebKey = { kty: "OKP", crv: "Ed25519", x: "REPLACE-ME" };
```

`dev/license-keygen.ts`:
```ts
/* One-off. Prints a fresh Ed25519 keypair. PUBLIC goes into packages/auth/src/license-public.ts;
 * PRIVATE goes into `wrangler secret put LICENSE_PRIVATE_KEY` (apps/api) and .env — never into git. */
import { exportJWK, generateKeyPair } from "jose";
const { privateKey, publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
console.log("PUBLIC  (commit):", JSON.stringify(await exportJWK(publicKey)));
console.log("PRIVATE (secret):", JSON.stringify(await exportJWK(privateKey)));
```

`packages/auth/src/index.ts`: add `export * from "./license.ts";` and `export * from "./license-public.ts";`.

- [ ] **Step 4: Generate the real keypair**

```bash
bun dev/license-keygen.ts
```
Paste the PUBLIC JWK into `license-public.ts`. Give the PRIVATE line to Ahmed for `wrangler secret put LICENSE_PRIVATE_KEY` in `apps/api` and `LICENSE_PRIVATE_KEY=…` in `.env`. Do not paste the private key into the report or any file in the repo.

- [ ] **Step 5: Verify and commit**

```bash
bun test packages/auth && bun run typecheck
git add packages/auth/src/license.ts packages/auth/src/license-public.ts packages/auth/src/license.test.ts packages/auth/src/index.ts dev/license-keygen.ts
git commit -m "feat(auth): ed25519 box license tokens with a shipped public key"
```

---

### Task 3: The Box accepts a license and reports itself

**Files:**
- Create: `apps/api/src/modules/admin/box-license.ts`, `apps/api/src/modules/admin/box-license.test.ts`
- Modify: `apps/api/src/app.ts:16-35`, `apps/api/src/modules/admin/setup.ts` (14 days), `apps/box/src/serve.ts`, `apps/box/src/box.test.ts`

**Interfaces:**
- `buildApp` option becomes `{ box?: { installId: string; setupCode: string; onLicense: (token: string) => Promise<void> } }` (replaces `setupCode`).
- Box routes: `GET /box/info → { installId, version, license: { licenseId, plan, name, expiresAt } | null }`; `POST /box/license { key } → 200 { expiresAt, plan, name }`, 403 on bad or foreign key.
- `startBox` returns `installId` too.

- [ ] **Step 1: Failing test for the license route**

`apps/api/src/modules/admin/box-license.test.ts`:
```ts
import { test, expect } from "bun:test";
import { exportJWK, generateKeyPair } from "jose";
import { signLicense } from "@odr/auth";
import { buildBoxLicenseRoutes } from "./box-license.ts";

const INSTALL = "11111111-1111-1111-1111-111111111111";
const post = (app: ReturnType<typeof buildBoxLicenseRoutes>, key: string) =>
  app.request("/box/license", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key }) });

test("a matching key sets subscription_end to expiry plus grace and is kept", async () => {
  const { privateKey, publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const ends: string[] = []; const kept: string[] = [];
  const repo = { listTenants: async () => [{ id: "t1" }], setSubscriptionEnd: async (_id: string, end: string) => { ends.push(end); } } as never;
  const app = buildBoxLicenseRoutes({ installId: INSTALL, publicJwk: await exportJWK(publicKey), repo, onLicense: async (t) => { kept.push(t); } });
  const key = await signLicense({ installId: INSTALL, licenseId: "L-1", name: "Zow", plan: "yearly", expiresAt: "2027-09-05" }, await exportJWK(privateKey));
  const res = await post(app, key);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ expiresAt: "2027-09-05", plan: "yearly", name: "Zow" });
  expect(ends).toEqual(["2027-09-08"]);
  expect(kept).toEqual([key]);
});

test("a key for another box, or a forged one, is refused and writes nothing", async () => {
  const ours = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const ends: string[] = [];
  const repo = { listTenants: async () => [{ id: "t1" }], setSubscriptionEnd: async (_id: string, end: string) => { ends.push(end); } } as never;
  const app = buildBoxLicenseRoutes({ installId: INSTALL, publicJwk: await exportJWK(ours.publicKey), repo, onLicense: async () => {} });
  const other = await signLicense({ installId: "22222222-2222-2222-2222-222222222222", licenseId: "L-2", name: "X", plan: "yearly", expiresAt: "2027-01-01" }, await exportJWK(ours.privateKey));
  expect((await post(app, other)).status).toBe(403);
  expect((await post(app, "not-a-token")).status).toBe(403);
  expect(ends).toEqual([]);
});
```

- [ ] **Step 2: Run to see it fail** — `bun test apps/api/src/modules/admin/box-license.test.ts` → cannot find module.

- [ ] **Step 3: Implement the route**

`apps/api/src/modules/admin/box-license.ts`:
```ts
import { Hono } from "hono";
import { z } from "zod";
import { verifyLicense } from "@odr/auth";
import { ForbiddenError, ValidationError } from "@odr/shared";
import { addDays } from "./domain.ts";
import type { AdminRepo } from "./ports.ts";
import { errorHandler } from "../../middleware/error.ts";

/*
 * Box only. A signed key from our team, bound to this Box's install id, moves
 * the subscription end. Unauthenticated on purpose: it must work from the
 * "subscription ended" screen, and the signature is the authority.
 */
export const GRACE_DAYS = 3;

const schema = z.object({ key: z.string().min(20).max(4000) });

export const buildBoxLicenseRoutes = (deps: {
  installId: string;
  publicJwk: JsonWebKey;
  repo: Pick<AdminRepo, "listTenants" | "setSubscriptionEnd">;
  /** The Box persists the accepted key so About can show it after a restart. */
  onLicense: (token: string) => Promise<void>;
}) => {
  const r = new Hono();
  r.onError(errorHandler); // the unit test mounts this router alone
  r.post("/box/license", async (c) => {
    const parsed = schema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("invalid payload", { issues: parsed.error.issues });
    const lic = await verifyLicense(parsed.data.key, deps.publicJwk).catch(() => {
      throw new ForbiddenError("this key is not a valid Odr license");
    });
    if (lic.installId !== deps.installId) throw new ForbiddenError("this key was issued for a different Box");
    const [tenant] = await deps.repo.listTenants();
    if (!tenant) throw new ForbiddenError("set up the restaurant before entering a key");
    // Grace: a late renewal never stops a dinner service; About shows the real date.
    await deps.repo.setSubscriptionEnd(tenant.id, addDays(lic.expiresAt, GRACE_DAYS));
    await deps.onLicense(parsed.data.key);
    return c.json({ expiresAt: lic.expiresAt, plan: lic.plan, name: lic.name });
  });
  return r;
};
```
Add to `apps/api/src/modules/admin/domain.ts`, next to `addMonths`:
```ts
export const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
```

- [ ] **Step 4: Wire `buildApp`**

`apps/api/src/app.ts`: change the option to `opts: { box?: { installId: string; setupCode: string; onLicense: (token: string) => Promise<void> } } = {}` and the mount to:
```ts
  if (opts.box) {
    const repo = drizzleAdminRepo(db);
    app.route("/", buildSetupRoutes(admin.service, repo, opts.box.setupCode));
    app.route("/", buildBoxLicenseRoutes({ installId: opts.box.installId, publicJwk: LICENSE_PUBLIC_JWK, repo, onLicense: opts.box.onLicense }));
  }
```
with `import { LICENSE_PUBLIC_JWK } from "@odr/auth";` and the route import. In `apps/api/src/modules/admin/setup.ts` change `months: 12` to `months: 0` is not possible (`min 1` in `createRestaurant`) — instead keep `createRestaurant` as is and, right after it, `await repo.setSubscriptionEnd(res.tenantId, addDays(today(), 14));` (the route already has the repo; widen its `Pick` to include `setSubscriptionEnd`). Update the `// ponytail:` comment: "14 days to enter the key our team issues at install".

- [ ] **Step 5: The Box side**

In `apps/box/src/serve.ts`:
- After the secret block, an install id the same way: file `<dataDir>/install-id`, `crypto.randomUUID()` if missing, trimmed.
- A license file `<dataDir>/license` (may not exist). `onLicense = (t) => Bun.write(join(opts.dataDir, "license"), t)`.
- `buildApp({ box: { installId, setupCode, onLicense } })`.
- Route `GET /box/info`: read the license file if present, `verifyLicense(token, LICENSE_PUBLIC_JWK).catch(() => null)`, return `{ installId, version: process.env.ODR_VERSION ?? "dev", license: lic ? { licenseId, plan, name, expiresAt } : null }` with `cache-control: no-store`. Add `/box/license` to the prefix list that goes to `app.fetch` (or route `p.startsWith("/box/")` except `/box/info` and `/box/phone-urls`, which serve.ts answers itself).
- Return `installId` from `startBox`.
- `main.ts`: print `Install id: ${box.installId}` under the addresses (the sales person needs it).

- [ ] **Step 6: Box test**

Add to `apps/box/src/box.test.ts` first test, after setup: `const info = await (await fetch(`${box.url}/box/info`)).json()` → `expect(info).toMatchObject({ installId: box.installId, license: null })` and `expect(info.installId).toMatch(/^[0-9a-f-]{36}$/)`. After the restart already in that test: `expect((await (await fetch(`${box.url}/box/info`)).json()).installId).toBe(info.installId)` (stable across restarts). Then sign a key for `box.installId` with an ephemeral keypair — this must be REFUSED (the Box trusts only the shipped public key): `expect(res.status).toBe(403)`. (A positive end-to-end with the real key happens in Task 8's manual run.)

- [ ] **Step 7: Verify and commit**

```bash
bun run typecheck && bun test
git add apps/api/src/modules/admin/box-license.ts apps/api/src/modules/admin/box-license.test.ts apps/api/src/modules/admin/domain.ts apps/api/src/modules/admin/setup.ts apps/api/src/app.ts apps/box/src/serve.ts apps/box/src/main.ts apps/box/src/box.test.ts
git commit -m "feat: box accepts a signed license bound to its install id and reports version and expiry"
```

---

### Task 4: Cloud tables for Boxes

**Files:**
- Create: `packages/db/src/schema/boxes.ts`; Modify: `packages/db/src/schema/index.ts`
- Generated: `packages/db/drizzle/0012_*.sql`, `meta/0012_snapshot.json`, `meta/_journal.json`

- [ ] **Step 1: Schema**

`packages/db/src/schema/boxes.ts`:
```ts
import { pgTable, uuid, text, timestamp, date, integer, index, uniqueIndex } from "drizzle-orm/pg-core";

/** One offline Box install. Not a tenant: its restaurant lives only on the Box. */
export const boxes = pgTable(
  "boxes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    installId: text("install_id").notNull(),
    name: text("name").notNull(),
    plan: text("plan").notNull(),
    expiresAt: date("expires_at").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastVersion: text("last_version"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("boxes_install_id_idx").on(t.installId)],
);

/** Every key ever issued, so a renewal can be re-sent and check-in can hand out the latest. */
export const boxLicenses = pgTable(
  "box_licenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boxId: uuid("box_id").notNull().references(() => boxes.id, { onDelete: "cascade" }),
    licenseId: text("license_id").notNull(),
    months: integer("months").notNull(),
    expiresAt: date("expires_at").notNull(),
    token: text("token").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("box_licenses_box_idx").on(t.boxId)],
);

export type BoxRow = typeof boxes.$inferSelect;
export type BoxLicenseRow = typeof boxLicenses.$inferSelect;
```
Add `export * from "./boxes.ts";` to `packages/db/src/schema/index.ts`.

- [ ] **Step 2: Generate the migration**

```bash
bun run db:generate
ls packages/db/drizzle | tail -2
```
Expected: a new `0012_<name>.sql` creating both tables. Do NOT run `db:migrate` (the user does, against the cloud). Confirm the PGlite test still passes (it applies the whole folder): `bun test packages/db`.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/boxes.ts packages/db/src/schema/index.ts packages/db/drizzle
git commit -m "feat(db): boxes and box_licenses tables"
```

---

### Task 5: Admin API for Boxes, and the public check-in

**Files:**
- Create: `apps/api/src/modules/boxes/ports.ts`, `repo.drizzle.ts`, `repo.memory.ts`, `service.ts`, `routes.ts`, `module.ts`, `boxes.test.ts`
- Modify: `apps/api/src/app.ts` (mount), `apps/api/wrangler.toml` (comment listing the new secret), `.env.example`

**Interfaces:**
- Admin (behind the existing `adminAuth`, mounted at `/admin`): `GET /boxes → { boxes: BoxView[] }`; `POST /boxes { installId, name, plan, months } → 201 { box: BoxView, key }`; `POST /boxes/:id/renew { months } → 201 { box: BoxView, key }`; `GET /boxes/:id/licenses → { licenses }`; `PATCH /boxes/:id { notes }`.
- Public (no auth, mounted at `/public`): `POST /box/checkin { installId, version, licenseId?: string } → { key?: string }`.
- `BoxView = { id, installId, name, plan, expiresAt, status, daysRemaining, lastSeenAt, lastVersion, notes, createdAt }` using the existing `subscriptionStatus()` from `admin/domain.ts`.

- [ ] **Step 1: Ports and memory repo**

`ports.ts`:
```ts
import type { BoxRow, BoxLicenseRow } from "@odr/db/schema";
export interface BoxRepo {
  list(): Promise<BoxRow[]>;
  byId(id: string): Promise<BoxRow | null>;
  byInstallId(installId: string): Promise<BoxRow | null>;
  create(input: { installId: string; name: string; plan: string; expiresAt: string }): Promise<BoxRow>;
  setExpiry(id: string, expiresAt: string): Promise<void>;
  setNotes(id: string, notes: string | null): Promise<void>;
  seen(id: string, version: string): Promise<void>;
  addLicense(input: { boxId: string; licenseId: string; months: number; expiresAt: string; token: string }): Promise<BoxLicenseRow>;
  licenses(boxId: string): Promise<BoxLicenseRow[]>; // newest first
}
```
`repo.memory.ts`: a `Map`-backed implementation of every method (ids via `crypto.randomUUID()`, `createdAt`/`issuedAt` as `new Date()`), used by the tests.

- [ ] **Step 2: Failing tests**

`boxes.test.ts` (uses the memory repo and an ephemeral keypair):
```ts
import { test, expect } from "bun:test";
import { exportJWK, generateKeyPair } from "jose";
import { verifyLicense } from "@odr/auth";
import { inMemoryBoxRepo } from "./repo.memory.ts";
import { makeBoxesService } from "./service.ts";

const INSTALL = "11111111-1111-1111-1111-111111111111";
const setup = async () => {
  const { privateKey, publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const svc = makeBoxesService({ repo: inMemoryBoxRepo(), privateJwk: await exportJWK(privateKey), today: () => "2026-09-05" });
  return { svc, pub: await exportJWK(publicKey) };
};

test("register issues a key for the install id, expiring months from today", async () => {
  const { svc, pub } = await setup();
  const { box, key } = await svc.register({ installId: INSTALL, name: "Zow Cafe", plan: "yearly", months: 12 });
  expect(box.expiresAt).toBe("2027-09-05");
  expect(await verifyLicense(key, pub)).toMatchObject({ installId: INSTALL, plan: "yearly", expiresAt: "2027-09-05" });
});

test("renew extends from the later of today and the current expiry", async () => {
  const { svc, pub } = await setup();
  const { box } = await svc.register({ installId: INSTALL, name: "Zow", plan: "monthly", months: 1 }); // → 2026-10-05
  const r = await svc.renew(box.id, { months: 1 });
  expect(r.box.expiresAt).toBe("2026-11-05");
  expect((await verifyLicense(r.key, pub)).expiresAt).toBe("2026-11-05");
  expect((await svc.licenses(box.id)).map((l) => l.expiresAt)).toEqual(["2026-11-05", "2026-10-05"]);
});

test("the same install id cannot be registered twice", async () => {
  const { svc } = await setup();
  await svc.register({ installId: INSTALL, name: "A", plan: "yearly", months: 12 });
  await expect(svc.register({ installId: INSTALL, name: "B", plan: "yearly", months: 12 })).rejects.toThrow(/already/);
});

test("check-in records version and last seen, and hands out a newer key only", async () => {
  const { svc } = await setup();
  const { box, key } = await svc.register({ installId: INSTALL, name: "Zow", plan: "monthly", months: 1 });
  const first = await svc.checkin({ installId: INSTALL, version: "1.1.0", licenseId: (await svc.licenses(box.id))[0]!.licenseId });
  expect(first.key).toBeUndefined();
  const renewed = await svc.renew(box.id, { months: 1 });
  const second = await svc.checkin({ installId: INSTALL, version: "1.1.0", licenseId: (await svc.licenses(box.id))[1]!.licenseId });
  expect(second.key).toBe(renewed.key);
  expect(await svc.checkin({ installId: "unknown", version: "1.1.0" })).toEqual({});
  const view = (await svc.list()).find((b) => b.id === box.id)!;
  expect(view.lastVersion).toBe("1.1.0");
  expect(view.lastSeenAt).not.toBeNull();
  void key;
});
```

- [ ] **Step 3: Service**

`service.ts`:
```ts
import { signLicense } from "@odr/auth";
import { ConflictError, NotFoundError } from "@odr/shared";
import { addMonths, subscriptionStatus, todayISO } from "../admin/domain.ts";
import type { BoxRepo } from "./ports.ts";

export type BoxesServiceDeps = { repo: BoxRepo; privateJwk: JsonWebKey; today?: () => string };

const view = (b: Awaited<ReturnType<BoxRepo["list"]>>[number], today: string) => ({
  id: b.id, installId: b.installId, name: b.name, plan: b.plan, expiresAt: b.expiresAt,
  ...subscriptionStatus(b.expiresAt, today),
  lastSeenAt: b.lastSeenAt ? b.lastSeenAt.toISOString() : null,
  lastVersion: b.lastVersion, notes: b.notes, createdAt: b.createdAt.toISOString(),
});

export const makeBoxesService = ({ repo, privateJwk, today = todayISO }: BoxesServiceDeps) => {
  const issue = async (box: { id: string; installId: string; name: string; plan: string }, from: string, months: number) => {
    const expiresAt = addMonths(from, months);
    const licenseId = `L-${Date.now().toString(36).toUpperCase()}`;
    const token = await signLicense({ installId: box.installId, licenseId, name: box.name, plan: box.plan, expiresAt }, privateJwk);
    await repo.addLicense({ boxId: box.id, licenseId, months, expiresAt, token });
    await repo.setExpiry(box.id, expiresAt);
    return { key: token, expiresAt };
  };
  return {
    async list() { const t = today(); return (await repo.list()).map((b) => view(b, t)); },
    async register(input: { installId: string; name: string; plan: string; months: number }) {
      if (await repo.byInstallId(input.installId)) throw new ConflictError("this install id is already registered");
      const box = await repo.create({ ...input, expiresAt: today() });
      const { key } = await issue(box, today(), input.months);
      return { box: view((await repo.byId(box.id))!, today()), key };
    },
    async renew(id: string, input: { months: number }) {
      const box = await repo.byId(id);
      if (!box) throw new NotFoundError("box", id);
      const t = today();
      const { key } = await issue(box, box.expiresAt > t ? box.expiresAt : t, input.months);
      return { box: view((await repo.byId(id))!, t), key };
    },
    licenses: (id: string) => repo.licenses(id),
    async setNotes(id: string, notes: string | null) { if (!(await repo.byId(id))) throw new NotFoundError("box", id); await repo.setNotes(id, notes); },
    /** A Box that happens to be online: remember it, and hand back a newer key if one exists. */
    async checkin(input: { installId: string; version: string; licenseId?: string }): Promise<{ key?: string }> {
      const box = await repo.byInstallId(input.installId);
      if (!box) return {};
      await repo.seen(box.id, input.version);
      const [latest] = await repo.licenses(box.id);
      return latest && latest.licenseId !== input.licenseId ? { key: latest.token } : {};
    },
  };
};
export type BoxesService = ReturnType<typeof makeBoxesService>;
```
(`todayISO` and `subscriptionStatus` already exist in `admin/domain.ts`; export `todayISO` if it is not exported.)

- [ ] **Step 4: Drizzle repo, routes, module, mount**

`repo.drizzle.ts`: straightforward Drizzle over `boxes`/`boxLicenses` (`orderBy(desc(boxLicenses.issuedAt))` for `licenses`). `routes.ts`: two routers — `buildBoxAdminRoutes(svc)` with zod schemas (`installId: z.string().uuid()`, `name` 1–80, `plan: z.enum(["monthly","yearly"])`, `months: z.number().int().min(1).max(60)`, `notes: z.string().max(500).nullable()`) and `buildBoxPublicRoutes(svc)` with `checkin` (`installId uuid`, `version` 1–20, `licenseId` optional). `module.ts`: `boxesModule({ db, privateJwk })`. In `app.ts`: `const boxesPrivate = process.env.LICENSE_PRIVATE_KEY ? JSON.parse(process.env.LICENSE_PRIVATE_KEY) : null;` and when non-null mount `admin.routes` sibling `app.route("/admin", boxes.adminRoutes)` (must go through the same `adminAuth` — simplest: export `adminAuth` from `admin/routes.ts` and `r.use("*", adminAuth)` inside `buildBoxAdminRoutes`) and `app.route("/public", boxes.publicRoutes)`. Without the secret (the Box, dev without key) the routes are not mounted. Document `LICENSE_PRIVATE_KEY` in `apps/api/wrangler.toml`'s secrets comment and `.env.example`.

- [ ] **Step 5: Verify and commit**

`bun run typecheck && bun test` (the four new tests pass). Commit: `feat(api): admin boxes api issues and renews signed licenses; public box check-in`.

---

### Task 6: Boxes tab in the admin console

**Files:**
- Modify: `apps/admin/src/api.ts`, `apps/admin/src/app.tsx`, `apps/admin/package.json` (+`qrcode`, `@types/qrcode`)
- Create: `apps/admin/src/boxes.tsx`

- [ ] **Step 1: API client** — add to `api` in `apps/admin/src/api.ts`:
```ts
  boxes: (key: string) => call<{ boxes: BoxView[] }>(key, "/boxes").then((r) => r.boxes),
  registerBox: (key: string, p: { installId: string; name: string; plan: "monthly" | "yearly"; months: number }) => call<{ box: BoxView; key: string }>(key, "/boxes", p),
  renewBox: (key: string, id: string, months: number) => call<{ box: BoxView; key: string }>(key, `/boxes/${id}/renew`, { months }),
  boxLicenses: (key: string, id: string) => call<{ licenses: BoxLicense[] }>(key, `/boxes/${id}/licenses`).then((r) => r.licenses),
  setBoxNotes: (key: string, id: string, notes: string) => call<unknown>(key, `/boxes/${id}`, { notes }, "PATCH"),
```
with `BoxView` and `BoxLicense` types matching Task 5.

- [ ] **Step 2: The tab**

`apps/admin/src/boxes.tsx` exports `BoxesPage({ adminKey, onUnauthorized })`: left, a table (Name, Install id shortened to first 8 chars with a title attribute, Plan, Ends, Days left, Status via `StatusPill`, Last seen, Version) with a "Renew" button per row that asks for months (default 12 for yearly, 1 for monthly) and then shows the key; right, a `Card` "Register a Box" with Name, Install id (paste from the Box's setup screen or console), Plan (select), Months. After register or renew, a `Note kind="success"` shows the key in a `<textarea readOnly>` with a Copy button (`navigator.clipboard.writeText`) and a QR (`QRCode.toDataURL(key)` rendered in an `<img>`), and the sentence "Send this to the owner on WhatsApp. They enter it in Settings → About, or scan it." The key is long (≈300 chars); QR at 256 px is fine. Follow the existing `Card`/`Field`/`Button`/`Note`/`inputClass` components from `ui.tsx`; no new UI primitives.

In `apps/admin/src/app.tsx`, above the two-column layout add a two-button switch `Restaurants | Boxes` (state `tab`), and render `BoxesPage` when `tab === "boxes"`. Existing Restaurants content untouched.

- [ ] **Step 3: Verify** — `bun run typecheck`, `bun run build:admin`, then `bun run dev:api` with `LICENSE_PRIVATE_KEY` in `.env` and `bun run dev:admin`: register a Box with a made-up UUID, see a key and a QR; renew it; refresh the list. Commit: `feat(admin): boxes tab registers boxes, issues and renews license keys`.

---

### Task 7: About tab, key entry, setup shows the install id, daily check-in

**Files:**
- Modify: `apps/captain-pwa/src/lib/api.ts`, `apps/captain-pwa/src/routes/settings.tsx`, `apps/captain-pwa/src/shell/subscription.tsx`, `apps/captain-pwa/src/routes/setup.tsx`, `apps/captain-pwa/src/app.tsx` (pass nothing new; `SubscriptionEnded` reads `config()`), `apps/box/src/serve.ts` (check-in)
- Create: `apps/captain-pwa/src/routes/about.tsx`

- [ ] **Step 1: Client calls** in `lib/api.ts`:
```ts
  boxInfo: () => get<{ installId: string; version: string; license: { licenseId: string; plan: string; name: string; expiresAt: string } | null }>("/box/info"),
  applyLicense: (key: string) => send<{ expiresAt: string; plan: string; name: string }>("POST", "/box/license", { key }),
```

- [ ] **Step 2: About tab** — `routes/about.tsx` exports `AboutSection()`: loads `api.boxInfo()`; shows Version, Install id (mono, with a Copy button), License (plan and "valid until <date>", or "No license key yet — <days> days of trial left" derived from `session.subscriptionEndsAt`), and a form "Enter license key" (`<textarea>` accepting paste, or the camera: reuse nothing new — paste only; the QR the admin shows is scanned by the *phone* camera app which opens nothing, so on the Box the flow is copy-paste; state this in the hint). On success: toast "License accepted — valid until …", `patchSession({ subscriptionEndsAt })` is NOT enough because the session end includes grace; simply `window.location.reload()` after the toast. In `settings.tsx` add `{ key: "about", label: "About" }` to `TABS`, filter it to `config().offline`, render `<AboutSection />`.

- [ ] **Step 3: Ended screen** — in `shell/subscription.tsx`, when `config().offline`, `SubscriptionEnded` renders the same key form under the headline ("Enter the license key from Odr to continue") and reloads on success. Extract the form into `apps/captain-pwa/src/routes/about.tsx` as `LicenseKeyForm({ onAccepted })` and use it in both places.

- [ ] **Step 4: Setup shows the install id** — `routes/setup.tsx`: on mount `api.boxInfo()`; render above the fields: "Install id: `<id>` — give this to Odr to get your license key (Copy)". The `/box/info` route exists before setup, so it is available here.

- [ ] **Step 5: Daily check-in on the Box** — in `apps/box/src/serve.ts` after the server starts:
```ts
  // ponytail: best-effort. Offline Boxes fail fast and try again tomorrow; nothing depends on this.
  const cloud = process.env.ODR_CLOUD_URL ?? "https://odr-api.zowcode.workers.dev";
  const checkin = async () => {
    const lic = await currentLicense(); // the same helper /box/info uses
    const res = await fetch(`${cloud}/public/box/checkin`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ installId, version: process.env.ODR_VERSION ?? "dev", ...(lic ? { licenseId: lic.licenseId } : {}) }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    const body = res?.ok ? ((await res.json()) as { key?: string }) : null;
    if (body?.key) await app.request("/box/license", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: body.key }) });
  };
  void checkin();
  const timer = setInterval(() => void checkin(), 24 * 60 * 60 * 1000);
```
and `clearInterval(timer)` in `stop()`. Tests do not exercise this (no network); the existing box test must still pass — the check-in must never throw.

- [ ] **Step 6: Verify and commit** — `bun run typecheck && bun test`; `bun run build:box`; boot the host binary on a fresh folder, confirm `/box/info` before setup, the install id on the setup screen, About tab present, Restaurants/QR untouched. Commit: `feat(captain-pwa): about tab with install id, version and license key entry; box daily check-in`.

---

### Task 8: Docs, handbook, and the end-to-end run with the real key

**Files:**
- Create: `docs/deploy/box-sales.md`
- Modify: `docs/deploy/box-testing.md`, `docs/handbook/odr-handbook.html` (+ regenerate `Odr-Handbook.pdf`), `docs/superpowers/specs/2026-09-05-odr-box-offline-design.md` (Plan of work items 5 partially, record outcome)

- [ ] **Step 1: Sales guide** — `docs/deploy/box-sales.md`, plain words: what a Box is; the install visit (run the binary, read the install id off the setup screen, register it in Admin → Boxes with name, plan, months, copy the key, paste it in the Box's About tab or WhatsApp it to the owner); renewal (Admin → Boxes → Renew → send the key; if the Box is online it also picks the key up by itself within a day); what "last seen" means; moving to a new PC needs a new install id and a new key (old one revoked in our records); troubleshooting (wrong-Box key → 403 message; expired → ended screen with key entry; grace 3 days).

- [ ] **Step 2: Testing guide** — add a "License" section to `docs/deploy/box-testing.md`: enter a wrong-Box key (expect the refusal), enter the right key, check About and the banner, set the Mac clock past expiry to see the ended screen accept a renewal key (then reset the clock).

- [ ] **Step 3: Handbook** — new subsection in Section 06 area: "Your Odr Box licence": where the install id is, how a key arrives (WhatsApp text or QR), where to enter it (Settings → About, or the screen that appears when the plan ends), the 3-day grace. Regenerate the PDF with the Chrome command from `CLAUDE.md`.

- [ ] **Step 4: End-to-end with the real key** — requires `LICENSE_PRIVATE_KEY` set in `.env` (Ahmed) and the real public JWK committed in Task 2. Run `bun run dev:api` and `bun run dev:admin`; run the Box binary on a fresh folder; register its install id in Admin → Boxes; paste the key in About; confirm About shows the plan and date, the login footer shows `v1.1.0`, and `subscription_end` in the Box equals expiry + 3 days (`/api/v1/me` → `subscriptionEndsAt`). Renew from Admin, paste the new key, confirm the date moved. Record in the spec.

- [ ] **Step 5: Commit** — `docs: box sales guide, licence steps in the testing guide and handbook`.

---

## Self-review

**Spec coverage:** §4 install id → T3; key format and public key → T2; entering a key, grace, 14-day first run → T3, T7; Boxes panel → T5, T6; check-in → T5, T7; version stamp (§6 first bullet) → T1; docs rule → T8. Not in this plan: binary updates and rollback (§5), pilot/stable channels (§6), backup/installers/moving data (§7–9).

**Placeholder scan:** `REPLACE-ME` in `license-public.ts` is intentional and replaced in T2 step 4; the private key is deliberately never written down.

**Type consistency:** `LicenseClaims` fields (`installId, licenseId, name, plan, expiresAt`) used identically in T2, T3, T5; `buildApp({ box })` shape in T3 and the Box's `serve.ts`; `BoxView` in T5 and T6; `/box/info` shape in T3 and T7; `addDays`/`addMonths`/`subscriptionStatus`/`todayISO` from `admin/domain.ts` in T3 and T5.
