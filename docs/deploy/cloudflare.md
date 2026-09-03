# Deploying Odr on Cloudflare

Written for whoever is doing the deploy. Read "The three blockers" first — two
of them decide the shape of the whole thing.

---

## What we are deploying

| Piece | What it is | Where it goes |
|---|---|---|
| `apps/captain-pwa` | Waiter / cashier / kitchen | Cloudflare **Pages** |
| `apps/diner` | Public QR menu | Cloudflare **Pages** |
| `apps/admin` | Internal Odr team console | Cloudflare **Pages** (access-restricted) |
| `apps/api` | Hono API | **Worker** *or* a Bun host — see below |
| Postgres | Supabase | stays where it is |

The three front-ends are plain static bundles. `bun run build:web` produces
`apps/<app>/dist` for each. That part is done and verified — no blockers.

---

## The three blockers

### 1. The API cannot run on Workers as written

Two Bun-only APIs are in the hot path:

| File | Uses | Why Workers rejects it |
|---|---|---|
| `packages/db/src/index.ts` | `import { SQL } from "bun"` | The Bun SQL driver does not exist off Bun. |
| `packages/auth/src/password.ts` | `Bun.password` argon2id, `memoryCost: 19456` | No native argon2 on Workers, and 19 MB per hash against a 128 MB isolate with a hard CPU budget is not viable in pure JS. |

Both are fixable, neither is free:

- **DB** → swap to `postgres` (postgres.js) with `drizzle-orm/postgres-js`, fronted by
  **Cloudflare Hyperdrive** for pooling. One file changes (`packages/db/src/index.ts`).
  Hyperdrive matters for a second reason — see "Connection limits" below.
- **Passwords** → swap argon2id for PBKDF2-SHA256 via WebCrypto, which Workers has
  natively. Existing hashes do not verify under the new scheme, so you need a
  migration: keep both verifiers, re-hash on next successful login, drop the old
  path once everyone has signed in. Budget a sprint, not an afternoon.

### 2. Network printing cannot work from any cloud, Cloudflare or not

`POST /api/v1/print/bills/:id` opens a TCP socket to the outlet's printer IP —
`192.168.1.50`. That address is inside the restaurant's LAN. A Worker, a Fly
box, anything hosted, cannot reach it. This is not a Cloudflare limitation; it
breaks the moment the API leaves the restaurant's own network.

**What still works in production:** the browser Print button. It renders the
58/72 mm thermal CSS and prints to any printer the device already has, which is
how most small restaurants are set up anyway.

**If a restaurant insists on direct network printing,** the options are a small
print agent running on a machine inside the restaurant that polls the API, or
keeping "Kitchen printer" as an on-premise-only feature. Decide before selling
it — the Settings screen currently offers the field to everyone.

### 3. Connection limits

Supabase's pooler caps at **15 clients in session mode**. We hit exactly this
during testing (`EMAXCONNSESSION`) with one dev server hot-reloading. Workers
are far more parallel than one dev box. Use the **transaction** pooler (port
6543) plus Hyperdrive, or you will see this in production under lunch load.

---

## Recommended path

**Phase 1 — ship now, zero code changes.** Front-ends on Pages; API on a
Bun-capable host (Fly.io, Railway, Render, or a small VPS) behind Cloudflare
DNS. Everything already works exactly as tested.

**Phase 2 — move the API to Workers** once the two swaps above are done and
tested. Nothing in the front-ends changes.

The rest of this document covers Phase 1 with the Phase 2 Worker config
included, so you can do either.

---

## Same-origin, so there is no CORS to manage

The dev server proxies `/api/*` and `/auth/*` to the API so the browser stays
same-origin. Keep that property in production by putting the API on a **route
of the same hostname**, not a separate subdomain:

```
pos.odr.app/*        → Pages   (captain-pwa)
pos.odr.app/api/*    → API
pos.odr.app/auth/*   → API
order.odr.app/*      → Pages   (diner)
admin.odr.app/*      → Pages   (admin)
```

Do this and no app code changes, no CORS allowlist, and the JWT never crosses
an origin. The `_redirects` file the build emits already leaves `/api` and
`/auth` alone for the route to claim.

If you must use a separate API subdomain instead, you will need CORS on the API
and a way to tell the front-end its API base — neither exists today.

---

## One-time setup

### 1. Cloudflare

```bash
bun add -g wrangler
wrangler login
```

Create three Pages projects (dashboard or CLI):

```bash
wrangler pages project create odr-captain --production-branch main
wrangler pages project create odr-diner   --production-branch main
wrangler pages project create odr-admin   --production-branch main
```

Put the admin project behind **Cloudflare Access** (Zero Trust → Applications).
It is an internal console; it should not be on the open internet even though it
also checks an admin key.

### 2. Secrets

GitHub repository secrets, for CI:

| Secret | What |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token with *Pages: Edit* (+ *Workers: Edit* for Phase 2) |
| `CLOUDFLARE_ACCOUNT_ID` | From the Cloudflare dashboard |
| `DINER_ORIGIN` | e.g. `https://order.odr.app` — baked into the captain build |

API host secrets (never in the repo):

| Variable | What |
|---|---|
| `DATABASE_URL` | Supabase **transaction** pooler URL (port 6543) |
| `JWT_SECRET` | `openssl rand -hex 32`. Rotating it signs everyone out. |
| `ADMIN_KEY` | `openssl rand -hex 32`. Guards `/admin`. |
| `DEFAULT_COUNTRY` | `IN` |

### 3. Database

Run migrations once against production before the first deploy:

```bash
DATABASE_URL=<prod> bun run db:migrate
```

Then create the first restaurant through the admin console — that is what it is
for. No seed script in production.

---

## Deploying

CI does this on every push to `main`. Manually:

```bash
# front-ends
DINER_ORIGIN=https://order.odr.app bun run build:web
wrangler pages deploy apps/captain-pwa/dist --project-name odr-captain
wrangler pages deploy apps/diner/dist       --project-name odr-diner
wrangler pages deploy apps/admin/dist       --project-name odr-admin

# API (Phase 1, Bun host — example: Fly)
fly deploy
```

### `DINER_ORIGIN` is load-bearing

It is baked into the captain build and it is what the printed table QR codes
point at. Get it right **before** anyone prints and laminates QR cards —
changing it later means reprinting every card.

### Phase 2 Worker config

`apps/api/wrangler.toml`, for when the two swaps are done:

```toml
name = "odr-api"
main = "src/worker.ts"
compatibility_date = "2026-08-01"
compatibility_flags = ["nodejs_compat"]

[[routes]]
pattern = "pos.odr.app/api/*"
zone_name = "odr.app"

[[routes]]
pattern = "pos.odr.app/auth/*"
zone_name = "odr.app"

[[hyperdrive]]
binding = "DB"
id = "<hyperdrive-id>"
```

`src/worker.ts` is three lines — Hono already exports a fetch handler:

```ts
import { buildApp } from "./app.ts";
const app = await buildApp();
export default { fetch: app.fetch };
```

Secrets go in with `wrangler secret put JWT_SECRET` (and `ADMIN_KEY`).

---

## Release notes that change the deploy

### 2026-09-03 — multi-outlet

Migration `0008_spicy_doorman` adds `memberships.outlet_id`, `outlets.is_active`,
`outlets.menu_mode`, the `menu_item_soldout` table and composite
`(outlet_id, tenant_id)` foreign keys, then backfills: every captain / cashier /
kitchen membership is pinned to its tenant's outlet, and legacy menu rows that
the old PWA wrote with an `outlet_id` are un-pinned so a second outlet sees the
shared menu. The API reads those columns on every request, so the order is:

```bash
DIRECT_URL=<prod direct URL> bun run db:migrate   # 1. schema first
cd apps/api && bunx wrangler deploy               # 2. API
cd ../.. && bun run build:web                     # 3. front-ends (DINER_ORIGIN set)
for a in captain-pwa diner admin; do (cd apps/$a && bunx wrangler deploy); done
```

Front-end API shapes are extended, never changed, so a lagging front-end is
fine; a lagging migration is not. The `/api/v1/outlets` create route is gone —
outlets are added only through the admin console.

Smoke test additions: sign in as an owner with two outlets → the "Choose an
outlet" step appears → the outlet name in the topbar opens the switcher → a
dish marked sold out at one outlet stays on sale at the other → Sales shows the
"All outlets" toggle.

---

## After every deploy — 2 minute smoke test

1. `curl https://pos.odr.app/api/v1/../health` → `{"ok":true}`
2. Sign in on the captain app.
3. Open a table, add an item, **Fire KOT**.
4. Kitchen screen shows the ticket within 5 seconds.
5. **Settle & bill** → the bill renders with GST lines.
6. Scan a table QR on a real phone → the menu loads.

If step 4 fails, the front-end reached the API but polling did not — check the
Worker route covers `/api/*`. If step 2 fails with a network error, the route
is not attached to that hostname.

---

## Rollback

Pages keeps every deployment. Dashboard → the project → Deployments → **Rollback**
on the last good one. Instant, no rebuild.

For the API, redeploy the previous commit. **Database migrations do not roll
back** — treat every migration as forward-only and additive, and never ship a
migration and the code that depends on it in the same deploy if you might need
to revert.

---

## What is deliberately not here

- **No CDN caching rules for the API.** Every response is per-tenant and
  authenticated. Cache it and you will serve one restaurant another's orders.
- **No service worker / offline mode.** Out of scope; the apps need the network.
- **No staging environment.** Add one when a second restaurant is live — right
  now the cost of a bad deploy is a phone call, and Pages rollback is instant.
