# Odr

Restaurant management system — Petpooja-class for India-first, Saudi-second.
Two-founder team (Sheikh Ziad + Ahmed Afrid). Bun monorepo, hexagonal modular monolith.

> **Strategic context, agents, work packages, and architecture decisions live in the
> Odr tenant on the [precise](https://precise.dev) platform** — not in this repo.
> This README covers the runtime + how to get it running locally.

---

## Status as of latest commit

**End-to-end working against Supabase Postgres:**

```
register → login → /me → create master/outlet category → create item
   → open table → add items (with taxClass) → fire KOT → settle
   → auto-bill emits → invoice with per-rate GST breakdown persisted
```

| Module | What it does | Live? |
|---|---|---|
| `identity` | register / login / JWT / RBAC | ✅ |
| `menu` | categories + items, master + per-outlet override | ✅ |
| `outlets` | outlet CRUD with GSTIN format validation | ✅ |
| `ordering` | table + KOT lifecycle FSM, drizzle-persisted (orders survive restarts), channels: dine_in / parcel / zomato / swiggy / other / qr | ✅ |
| `billing` | settle → GST-compliant bill with per-(component, rate) breakdown, sequential invoice numbers | ✅ |
| `admin` | ADMIN_KEY-gated internal API: create restaurants, subscription top-ups, menu import (JSON/CSV) | ✅ |
| `public` | tokenized table-QR menu + diner ordering (no auth, server-side pricing, rate-limited) | ✅ |
| `printing` | network ESC/POS to the outlet's kitchen printer (58/80mm) | ✅ |

**Apps:** `captain-pwa` (:3001, waiters/captains — phones + tablets), `admin`
(:3002, internal team), `diner` (:3003, public QR ordering).

**Known gaps to keep in your head:**

1. **Postgres RLS not yet enabled** — tenant filtering is at the application layer.
   Hardening to RLS is on the architect's plate.
2. **CI is not wired** — pre-commit (husky + lint-staged + commitlint) guards locally;
   GitHub Actions still TODO.
3. **Zomato/Swiggy are manual quick-entry channels** — no partner API integrations.

---

## Setup (5 minutes)

### 1. Prerequisites

- [Bun](https://bun.sh) ≥ 1.3
- A Supabase project (free tier is fine) — you'll need its **transaction pooler URL**
  (port 6543) and **direct URL** (port 5432). Find both under
  Dashboard → Settings → Database → Connection string.

### 2. Clone & install

```bash
git clone https://github.com/sheikhziad/odr.git
cd odr
bun install        # installs workspace deps + sets up husky hooks
```

### 3. `.env`

```bash
cp .env.example .env
```

Edit `.env` and fill in:

- `DATABASE_URL` — Supabase **transaction pooler** URL (port 6543, used by API at runtime)
- `DIRECT_URL` — Supabase **direct connection** URL (port 5432, used by drizzle-kit migrations)
- `JWT_SECRET` — generate one with `openssl rand -base64 64`. **Not** a Supabase JWT.
- `DEFAULT_COUNTRY` — `IN` (default) or `SA` — picks the active TaxStrategy

> **⚠️ Supabase quirk built into the codebase:** the transaction pooler rejects
> prepared statements (PostgresError 42P05). `packages/db/src/index.ts` therefore
> sets `prepare: false` on the Bun.sql client. If you change the connection
> setup, keep this in mind.

### 4. Migrate + seed + run

```bash
bun run db:migrate          # applies SQL migrations under packages/db/drizzle/
# now register an owner against the running API:
bun run dev:api &           # starts API on :3000
curl -X POST localhost:3000/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"changeme123","fullName":"Your Name"}'

# then seed the demo tenant + outlet + owner membership for that user:
bun run db:seed you@example.com
```

The seed prints the `tenantId` and `outletId` you'll use to log in and place orders.

### 5. Smoke-test the full flow

```bash
TENANT=<from seed output>
OUTLET=<from seed output>

# login → token
TOK=$(curl -s -X POST localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d "{\"email\":\"you@example.com\",\"password\":\"changeme123\",\"tenantId\":\"$TENANT\"}" \
  | jq -r .token)

# create category + item
CAT=$(curl -s -X POST localhost:3000/api/v1/menu/categories \
  -H "authorization: Bearer $TOK" -H 'content-type: application/json' \
  -d '{"name":"South Indian"}' | jq -r .category.id)

curl -X POST localhost:3000/api/v1/menu/items \
  -H "authorization: Bearer $TOK" -H 'content-type: application/json' \
  -d "{\"categoryId\":\"$CAT\",\"name\":\"Masala Dosa\",\"basePrice\":\"120.00\",\"taxClass\":\"GST_5\",\"isVeg\":true}"

# open → fire → settle → bill
ORD=$(curl -s -X POST localhost:3000/api/v1/ordering/orders \
  -H "authorization: Bearer $TOK" -H 'content-type: application/json' \
  -d "{\"outletId\":\"$OUTLET\",\"tableLabel\":\"T-1\"}" | jq -r .order.id)

curl -X POST localhost:3000/api/v1/ordering/orders/$ORD/items \
  -H "authorization: Bearer $TOK" -H 'content-type: application/json' \
  -d '{"lines":[{"itemId":"00000000-0000-0000-0000-000000000001","itemName":"Masala Dosa","qty":2,"unitPriceMinor":12000,"taxClass":"GST_5","modifiers":[]}]}'

curl -X POST localhost:3000/api/v1/ordering/orders/$ORD/fire-kot -H "authorization: Bearer $TOK"
curl -X POST localhost:3000/api/v1/ordering/orders/$ORD/settle    -H "authorization: Bearer $TOK"

# the bill auto-materializes via the order.settled event subscriber.
# fetch via repair endpoint (idempotent):
curl -X POST localhost:3000/api/v1/billing/bills \
  -H "authorization: Bearer $TOK" -H 'content-type: application/json' \
  -d "{\"orderId\":\"$ORD\"}" | jq
```

You should see an invoice number in `MC/2026-27/00001` form, with `taxBreakdown`
showing `CGST` + `SGST` rows.

---

## Repo layout

```
odr/
├── apps/
│   ├── api/                   # Hono on Bun.serve — composition root in src/app.ts
│   ├── web/                   # (empty) manager dashboard target
│   └── captain-pwa/           # (empty) tablet/captain offline-first PWA target
├── packages/
│   ├── shared/                # Money (bigint minor units), errors, branded ids, Result
│   ├── auth/                  # argon2id (Bun.password), JWT (jose), RBAC matrix
│   ├── tenancy/               # AsyncLocalStorage RequestContext (tenantId/userId/role)
│   ├── tax/                   # TaxStrategy + IN GST + SA VAT (registry-driven)
│   ├── printing/              # ESC/POS renderer + null/network transports
│   ├── events/                # EventBus port + InMemoryEventBus
│   └── db/                    # Drizzle schema, migrations, Bun.sql client, seed
└── apps/api/src/modules/
    ├── identity/  menu/  outlets/  ordering/  billing/
```

### Canonical module shape

Every module under `apps/api/src/modules/<name>/` is **six files**:

```
domain.ts        # entities + value objects (pure, no I/O)
ports.ts         # interfaces (Repo, OrderLookup, etc.)
service.ts       # use cases — depends only on ports
repo.drizzle.ts  # the only file that imports drizzle-orm
routes.ts        # Hono router → calls service
module.ts        # composition root: wires adapters → service → routes
```

**Discipline:**
- `routes.ts` knows about Zod + Hono; nothing else.
- `service.ts` calls `getContext()` for tenancy; never accepts `tenantId` as a parameter.
- `repo.drizzle.ts` is the **only** file outside `@odr/db` that imports drizzle-orm.
- Cross-module talk happens **via events** (see `billing/module.ts` subscribing to `order.settled`),
  not direct service imports.

### Money rules (don't violate these)

- All currency stored and computed in **bigint minor units** (paise/halala).
  Schema columns are `numeric(20, 0)`.
- Use `@odr/shared`'s `Money` value object for arithmetic; never `Number`.
- Tax breakdowns bucket by `(component_name, rate)` — a mixed-rate order
  produces multiple `CGST` rows, never one collapsed row.

---

## Commands

```bash
bun run dev:api          # bun --hot apps/api/src/server.ts (port 3000)
bun run db:generate      # generate SQL migration from drizzle schema changes
bun run db:migrate       # apply pending migrations to Supabase (uses DIRECT_URL)
bun run db:seed [email]  # idempotent — seed Odr Demo tenant + outlet + owner membership
bun run typecheck        # bunx tsc --noEmit -p tsconfig.json
bun test                 # run all tests (15+ across tax, ordering, menu, billing)
```

---

## Working in this repo

### Git hooks (active on every commit)

- **`pre-commit`** runs `bunx tsc --noEmit -p tsconfig.json` if any `*.ts` is staged.
- **`commit-msg`** runs commitlint with `@commitlint/config-conventional` and
  a locked **scope** enum from `commitlint.config.js`.

### Conventional Commits

```
<type>(<scope>): <subject>

<body>
```

Allowed types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, etc.
Allowed scopes (extend in `commitlint.config.js` when needed):

```
api, api/billing, api/identity, api/menu, api/ordering, api/outlets,
auth, db, events, packages, printing, shared, tax, tenancy,
web, captain-pwa, ci, deps
```

Examples:
- `feat(api/menu): add modifier groups`
- `fix(db): correct outlets prefix uniqueness`
- `chore(ci): add github actions workflow`

### Logical commits, not big-bang

When a slice involves multiple concerns (CI fix + feature work, schema + module),
commit them as **separate logical units**. The pre-commit hook will catch type
errors regardless.

---

## Architecture in precise

The full architecture, agents, work packages, and decisions are in the
**Odr tenant on precise**.

### Front-end surfaces (per `precise ea asset ls`)

| Asset | Purpose | Status |
|---|---|---|
| `Web POS (PWA)` | Tablet-first — billing, KOT, menu, settings (cashier/captain surface) | folder exists, empty |
| `Owner Companion App` | React Native phone app for owners — reports + alerts | not started |
| `Onboarding Portal` | Web portal for outlet onboarding + self-serve | not started |
| `Diner Table-QR Web App` | Lightweight QR-scan web for diners | not started |
| `Design System` | Shared design tokens + components (lean — use shadcn) | not started |

### Front-end stack rules (per `Tech Stack and Build Constraints` context + `odr-ux-engineer` persona)

- **React 19 + Tailwind + shadcn**
- **Bun HTML imports + Bun bundler** — no Vite, no webpack
- **PWA service worker + IndexedDB sync queue** for offline-first (captain especially)
- State machines for any flow > 3 states
- Indic + Arabic script rendering across UI
- One screen = one job (captain UI), color-blind safe + dark-mode-default (kitchen display)
- **No custom design system in year 1** — use shadcn + Tailwind tokens

### Back-end stack rules

- **Bun + Hono** for the API; `Bun.serve()`, never express
- **Bun.sql + Drizzle** against Postgres (Supabase managed today)
- **JWT (HS256 via jose)** for auth; argon2id passwords via `Bun.password`
- **RLS at DB level for tenant isolation** — application-layer filtering is **not** trusted alone *(planned, not yet active)*
- **Lean buy** for: auth providers, GST/ZATCA invoicing, notifications (WhatsApp/SMS), observability
- **No Kubernetes, no microservices, no custom DS in year 1**

---

## Open precise tickets (CLI bugs filed against the platform)

- `0b55a02d` (critical) — `precise auth agent-login` collapses every valid agent
  API key to the most recently created agent. Multi-agent attribution is
  effectively non-functional today.
- `22370e6e` (medium) — `precise wk te ls` returns empty `entityId.shortId`,
  so time entries can't be deleted/edited individually.

These don't block product work — flagged so neither of us wastes time
debugging "why is everything attributed to one agent."

---

## Roles in the codebase (semantic, per agent personas in precise)

These are *who owns what* — attribution is currently broken (see above).
Once `0b55a02d` is fixed, work will get logged correctly.

| Agent | Owns | Persona file (precise) |
|---|---|---|
| `odr-platform-architect` | monorepo health, cross-cutting packages, CI, RLS | `8bd2d457` |
| `odr-billing-engineer` | billing, tax, GST e-invoicing, payments | `9fa9f966` |
| `odr-ordering-engineer` | ordering FSM, KOT, kitchen display, inventory | `743ff180` |
| `odr-printing-engineer` | @odr/printing, ESC/POS, Tauri sidecar | `baa975d5` |
| `odr-ux-engineer` | apps/web, apps/captain-pwa | `5675ec84` |

---

## License

Proprietary — internal to Odr. Not for redistribution.
