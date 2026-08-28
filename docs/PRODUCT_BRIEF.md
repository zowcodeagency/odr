# Odr — Product Brief

> **Source of truth:** This document is a faithful extract from the Odr tenant
> on the precise platform (May 2026). For the latest canonical state, query
> precise directly. This file is meant to be:
>
> 1. An onboarding read for the team and any new contributor.
> 2. The design brief for wireframes + high-fidelity work (e.g. Claude design).
>
> Where this brief mentions an ID like `5339cdf3` or `1657f83c`, that's the
> precise short-id you can pull deeper detail from with
> `precise <module> <entity> get <id>`.

---

## 1. North Star

> Build the most loved, all-in-one restaurant management and billing platform
> for India and the Middle East — a faster, cleaner, and friendlier alternative
> to Petpooja that local restaurants actually enjoy using.

**Vision (2031):** Become the default restaurant management platform for India
and the Middle East within 5 years.

**Aspirations:**
- 5,000 paying outlets by 2031
- ₹30 crore ARR by 2031
- Owner NPS > 70
- Outlet onboarding under 2 hours

**Where to play:**
| Segment | Detail |
|---|---|
| Mangalore beachhead | Tier-2 South India city — start at home |
| Karnataka tier-2 | Mysuru, Hubballi-Dharwad, Belagavi, Udupi |
| Saudi Arabia | Riyadh + Jeddah QSR + casual-dining |
| Customer | Independent owner-operated restaurants, 1–3 outlets |

**How to win:**
1. **Friendlier UX than Petpooja** — one-screen billing, fast onboarding
2. **Aggregator sync that does not break** — reliable Swiggy + Zomato sync
3. **Honest undercut pricing** — ₹6,000–10,000 per outlet per year

**Strategic logic (verbatim from the Odr North Star strategy):**

> Petpooja owns the Indian independent-restaurant POS market by default, not by
> delight — owners complain about UX, integration breakages, and pricing. A
> focused product that nails Mangalore first, halves the price, and lands
> aggregator sync reliably can flip 500–1000 outlets in 24 months and use that
> proof to expand into Karnataka and then Saudi where the same buyer pain
> exists with even less local competition.

**Deliberate exclusions** (we do **not** build these):

| Excluded | Why |
|---|---|
| In-app payment gateway | Restaurants prefer their own static QR / UPI; gateway adds compliance overhead with no clear willingness-to-pay |
| White-label loyalty program | Off-strategy distraction; partner if needed |
| Cloud kitchen ERP | Different buyer, different sales cycle; revisit after 1,000 outlets |
| Enterprise QSR chains (50+ outlets) | 9–12 month deal cycle; will dilute focus |
| Hardware reselling | Margin-thin; recommend partner devices instead — bring-your-own |

---

## 2. Success metrics (north-star KPIs)

| Metric | precise id | What it measures |
|---|---|---|
| Paying Outlets | `c803dd2f` | Live outlets on a paid tier |
| Annual Recurring Revenue | `763ca802` | ARR across India + KSA |
| Owner NPS | `4234a325` | Net Promoter Score from owner advisory pulse |
| Aggregator Sync Success Rate | `e50c3355` | % of menu/availability/order events that complete first try |
| Median Onboarding Time | `b49ac103` | Time from contract → first KOT printed |

---

## 3. Personas — the actual humans the product serves

These are the eight restaurant-side personas captured in precise. Use them as
named characters in flow diagrams and acceptance criteria.

### Operators (work *inside* the restaurant every day)

| precise id | Name | Description | Key behaviors | Tech proficiency |
|---|---|---|---|---|
| `1657f83c` | **Captain / Waiter** | Takes orders at table, sends KOTs to kitchen, services tables (India + KSA, 20–40) | Takes table orders · Modifies and reprints KOTs · Closes tables | Intermediate |
| `abd8f91e` | **Cashier / Front-of-house** | Daily user of the POS at the bill counter. Speed matters. (India + KSA, 20–35) | Bills 200+ orders per shift · Splits and merges tables · Reprints KOTs and bills | Intermediate |
| `e31bd4c6` | **Kitchen / KOT user** | Reads KOTs and pushes back when items run out or substitutions are needed (India + KSA, 20–50) | Reads incoming KOTs · Marks items 86'ed (out of stock) | **Novice** — UX must work for the least-tech user in the room |
| `2ab1f2ce` | **Restaurant Manager** | On-the-ground manager at a 2–5 outlet group; influences buying but does not sign the cheque (India tier-2, 28–45) | Closes shift and reconciles cash · Manages staff rosters · Pushes feedback to owner | Advanced |

### Buyers (decide whether to keep us)

| precise id | Name | Description | Key behaviors | Tech proficiency |
|---|---|---|---|---|
| `22784598` | **Independent Restaurant Owner (India)** | Owner-operator of a 1–3 outlet restaurant. Hands-on, watches the bill counter, knows every regular customer (India tier-2, 30–55) | Reviews daily sales report · Negotiates aggregator commissions · **Prefers WhatsApp for everything** · Decides POS procurement personally | Intermediate |
| `a81a5d5c` | **Saudi Restaurant Owner** | Riyadh or Jeddah owner of a 1–5 outlet QSR or casual-dining restaurant. ZATCA-aware. **Prefers Arabic UX.** (Riyadh, Jeddah, 28–50) | Tracks ZATCA compliance status · Negotiates with HungerStation/Jahez · Reviews daily sales | Intermediate |
| `fa3d2f04` | **Petpooja Switcher** | Existing Petpooja customer actively considering or attempting to switch — the **highest-intent acquisition target** (India tier-2, 30–50) | Posts complaints about Petpooja in owner WhatsApp groups · Asks for demo when prompted | Intermediate |

### End-customers (rarely, but real)

| precise id | Name | Description | Key behaviors | Tech proficiency |
|---|---|---|---|---|
| `f1c485ef` | **Dine-in Diner (Table QR)** | Customer at the table scanning a QR to order without waiting for the captain (India + KSA urban, 18–55) | Scans QR, orders, pays via UPI/Mada · Splits bill at table | Advanced |

> **Design implication.** The least-tech-proficient daily user is **kitchen
> staff** (novice). The screen they see is the kitchen display — it must be
> readable across the room, color-coded, with no fine print. This sets the
> minimum-bar for UI legibility on every other surface.

---

## 4. The five user-facing surfaces (from precise EA)

These are the apps the product ships. Each is a separate frontend codebase
under `apps/` in the repo.

| precise id | Surface | Primary persona | Description | Status today |
|---|---|---|---|---|
| `5339cdf3` | **Web POS (PWA)** | Captain, Cashier | Tablet-first PWA — billing, KOT, menu, settings. The flagship surface. | empty folder |
| `99bce76c` | **Owner Companion App** | Restaurant Owner | Phone app for owners — daily reports, alerts, WhatsApp digest links | not started |
| `6a01f8f4` | **Onboarding Portal** | Owner / Onboarder | Web portal for outlet onboarding, 12-point readiness check, self-serve later | not started |
| `b3890cba` | **Diner Table-QR Web App** | Diner | Lightweight web app diners load via QR scan; menu + cart + UPI/Mada pay | not started |
| `8d80f6f1` | **Design System** | All surfaces | Shared tokens + components — **shadcn + Tailwind**, no custom DS | not started |

There are **also four supporting kitchen-facing or owner-facing screens** that
will live inside the Web POS PWA rather than as separate apps:

- Kitchen Display Screen (KDS) — `c8931aae` KOT Context
- End-of-shift cashier reconciliation
- Owner reports view (when accessed from desktop, not phone)
- Settings / outlet config

---

## 5. Front-end stack (ADR-001, locked 2026-05-05)

> Documented in full on precise context `44b5b240` (Tech Stack and Build
> Constraints). This section is the design-relevant subset.

**Decision: React (CSR) + Tailwind + shadcn + Bun bundler via HTML imports +
service-worker PWA.** Not Next.js for the captain/cashier surface.

| Surface | Build target | Reason |
|---|---|---|
| Web POS (PWA) | React CSR + Bun bundler + service worker. Tauri sidecar later for USB hardware | 12-hour single-session app, must run offline |
| Owner Companion App | PWA first (was specced as React Native; downgraded until push/native is proven necessary) | Saves a toolchain |
| Onboarding Portal | Next.js (SSR) | Public-ish, marketing-adjacent, SEO useful |
| Diner Table-QR | Next.js (SSR) or Astro | Loaded fresh on every scan; first-paint latency directly hits diner UX |
| Design System | shadcn + Tailwind tokens | No custom DS in year 1 |

**UX principles (locked):**
- **One screen = one job** (captain UI). No multi-tab.
- **One-handed thumb operation** on tablets.
- **Color-blind safe** on every status indicator.
- **Dark mode default** for kitchen-display surfaces (long shifts, low light, glare).
- **Indic + Arabic typography** across every surface; RTL layout for Saudi.
- **Optimistic updates with explicit rollback paths** — never silently drop a captain's input.
- **State machines for any flow > 3 states** (XState or hand-rolled).

**Visual direction:**
- shadcn defaults with restaurant-appropriate accent palette (warm, food-friendly — concrete tokens to be set in design).
- Type scale tuned for tablet at arm's length (default body ~16px, prominent CTAs ~20px+).
- Receipt-style chrome on bill/KOT screens — dotted dividers, monospaced totals — but **never** on operational screens (those are dense, app-like).

---

## 6. Core flows (already implemented in the API)

These are the **back-end-proven** flows the front-end must surface. None of
these need new server work to render — every endpoint exists today.

### Flow A: Captain operating a table (the primary flow)

```
[Login screen]                                     POST /auth/login
    ↓
[PIN screen]  (multi-cashier shift handoff)        (planned, c8e499ed)
    ↓
[Outlet picker]  (skipped if single outlet)        GET /api/v1/me
    ↓
[Table grid / floor plan]                          GET /api/v1/ordering/orders?outletId=<>
    ↓
[Open table T-3]                                   POST /api/v1/ordering/orders
    ↓
[Menu browse — Categories → Items → Modifiers]     GET /api/v1/menu/categories?outletId=<>
                                                   GET /api/v1/menu/items?categoryId=<>
    ↓
[Cart]  with qty steppers, modifier sheets
    ↓
[Fire KOT]                                         POST /api/v1/ordering/orders/:id/items
                                                   POST /api/v1/ordering/orders/:id/fire-kot
    ↓
[Settle table] — payment method selection          POST /api/v1/ordering/orders/:id/settle
    ↓
[Bill view] — invoice number, GST breakdown        (auto-billed via order.settled event;
                                                    repair endpoint POST /billing/bills also exists)
    ↓
[Print receipt + KOT to thermal printer]           network port-9100; @odr/printing
```

### Flow B: Owner setting up a menu (admin)

```
[Categories list — master + per-outlet]            GET /api/v1/menu/categories  (no outletId = all)
    ↓
[Create category]                                  POST /api/v1/menu/categories  { outletId? }
    ↓                                                Pattern A:
                                                     - outletId omitted = master (all outlets)
                                                     - outletId set     = override for that outlet only
[Create item]                                      POST /api/v1/menu/items
                                                     { categoryId, basePrice, taxClass: "GST_5"|... , isVeg }
                                                     Tax class validated against active country's strategy.
```

### Flow C: Manager closing a shift (planned)

```
[End-of-shift screen]   (planned with multi-cashier — c8e499ed)
    - per-cashier sales subtotal
    - cash drawer count vs expected
    - cash deposit slip
    - reprint last 10 bills
```

### Flow D: Owner reviewing a day (planned)

```
[Daily summary card]    (Owner Companion app; planned)
    - revenue by outlet
    - top 10 items
    - aggregator vs dine-in split
    - WhatsApp digest CTA
```

### Flow E: Diner Table-QR ordering (planned)

```
[Scan QR]
    ↓
[Outlet branded menu]
    ↓
[Cart / per-diner split if same table]
    ↓
[Pay UPI (India) or Mada (KSA)]   (UPI = static QR; no gateway in v1)
    ↓
[Order joins captain's table view as a regular KOT]
```

---

## 7. Domain language — every UI label should match this

> The captain says "fire a KOT," not "submit kitchen ticket." Match the
> existing restaurant vocabulary. Internal precise term in parentheses.

| Word in UI | Domain meaning |
|---|---|
| **Outlet** | A single physical restaurant location belonging to a tenant |
| **Table** | A table at the outlet — has a `tableLabel` like "T-3", "Window-2" |
| **Order** | The lifecycle of items added at a table from open to settled |
| **KOT** (Kitchen Order Ticket) | The slip the kitchen prints when items are fired — order state transitions to `kot_fired` |
| **Settle** | The final state after payment; immutable. Triggers bill creation. |
| **Bill / Invoice** | The printable, GST/VAT-compliant settlement document. Format: `<PREFIX>/<FY>/<NNNNN>` |
| **Captain** | A waiter who takes orders at tables on a tablet PWA |
| **Cashier** | A user at the bill counter — settles and prints bills |
| **Master menu / Outlet override** | Categories/items can be tenant-wide (master, `outlet_id NULL`) or outlet-specific (override). Master rules unless overridden. |
| **Tax class** | A label like `GST_5`, `GST_18`, `VAT_15` — picked per item; the active country's strategy resolves the actual rate |
| **Modifier group / Modifier** | An item-attached configurable (e.g. "Spice level: Mild / Medium / Spicy") with min/max selection rules |
| **86'ed** | Kitchen language for "out of stock" — kitchen marks an item, captain sees disabled state |
| **Fiscal year** (India) | Apr 1 → Mar 31. Invoice numbering wraps here (e.g. `MC/2026-27/00001`) |

---

## 8. State machines — make these explicit in any flow diagram

### Order lifecycle (owned by the ordering module)

```
       open ──(add items)──▶ items_added ──(fire KOT)──▶ kot_fired ──(settle)──▶ settled
        │                         │                          │                       │
        └────(void)─────▶ voided ◀┴──(void)──────────────────┘                  (terminal — frozen)
                          (terminal)
```

- Illegal transitions return **HTTP 409 Conflict** with `from`/`to` meta —
  the UI should never *try* an illegal transition; route off the state.
- After `settled`, lines can't be added/edited (the API returns 409). UI must
  hide the "add item" CTA in that state.

### Cashier shift (planned, `c8e499ed`)

```
[Outlet logged in] → [PIN entry] → [Cashier active] → [PIN entry to handoff] → [New cashier active]
                          ▲              │                                              │
                          └──── auto-logout after 4 hours ──────────────────────────────┘
```

---

## 9. Brand context — Petpooja and how we're different

> Full detail on precise context `05584cbd` (**Competitive Reference: Petpooja**).

**What Petpooja restaurants love and we must match (or visibly explain why we're different):**

1. **Offline billing** — their #1 marketed feature. Local SQLite + Electron-style desktop app. Restaurants count on this; ISP outages happen. **We're not there yet.** Visual cue when offline must be explicit and confidence-building, not a scary banner.
2. **Wide hardware compatibility** — every printer "just works." Our captain UI must surface a printer-status indicator (online / offline / generic-fallback) prominently.
3. **Aggregator depth** — Swiggy/Zomato/Dunzo/Magicpin live, single inbox. Captain UI must reserve space for the aggregator order channel even before we ship the integrations.
4. **Owner WhatsApp digest** — owners read daily reports from WhatsApp, not in-app. Owner Companion must integrate with WhatsApp share, not replace it.

**Where we beat them — design must lean into these:**

1. **Tablet-native one-handed UX** — Petpooja's UI is desktop-first ported to web. We design for thumb-reach, big tap targets, swipe-driven navigation.
2. **Saudi from day 1** — ZATCA Phase-2 designed-in. Arabic RTL is first-class, not an afterthought tab.
3. **Open data model** — every screen has a discreet **Export** affordance (CSV/JSON). Visible commitment to no-lock-in.
4. **Modern, calm aesthetic** — Petpooja looks 2014. We look 2026. Restraint in chrome, clear typography, generous whitespace on the operator screens (kitchen/captain) where eye fatigue is real.
5. **Lower price tier** — pricing UI / upgrade CTA must feel honest, not aggressive. No dark patterns.

---

## 10. Initiatives roadmap (precise wk projects + initiatives)

### Strategic initiatives (precise SBM)

| precise id | Initiative | Status |
|---|---|---|
| `50d8d409` | **Mangalore MVP and Beachhead** | Proposed (active focus) |
| `2dbe7d1c` | Karnataka Tier-2 Rollout | Proposed |
| `e85122b0` | Aggregator Sync Reliability | Proposed |
| `def57896` | Saudi Arabia Entry | Proposed |
| `02a88e80` | Multi-Outlet Chain Tier | Proposed |

### Active engineering projects (precise wk)

| Code | Project | Maps to initiative |
|---|---|---|
| `MVP` | Mangalore MVP & Beachhead | `50d8d409` |
| `KAR` | Karnataka Tier-2 Rollout | `2dbe7d1c` |
| `AGG` | Aggregator Reliability | `e85122b0` |
| `SAU` | Saudi Arabia Entry | `def57896` |
| `CHN` | Multi-Outlet Chain Tier | `02a88e80` |
| `PLAT` | Platform & Infra | (cross-cutting) |

### What's shipping in the MVP (sample epics)

A **partial** list — full picture in precise via `precise wk wp ls`:

- Mangalore beachhead — 50 outlets target
- Owner companion app v1
- Outlet onboarding (12-point check)
- Menu authoring
- KOT printing + thermal printer support
- Counter billing flow
- GST e-invoicing
- Web POS (PWA) v1
- Onboarding playbook v2
- Notifications service (WhatsApp + SMS)
- Public API gateway + auth
- Cloud foundation (India + KSA)
- Observability + SLOs
- ZATCA Fatoora Phase-2 certification
- Arabic localization (RTL + i18n)

---

## 11. What's been built vs what's pending (as of 2026-05-05)

### ✅ Working end-to-end against Supabase Postgres

- `register → login → /me`
- Menu CRUD with master/outlet-override pattern
- Outlet CRUD with GSTIN format validation
- Order lifecycle FSM (open → items_added → kot_fired → settled / voided)
- Auto-bill on order-settled with per-`(component, rate)` GST breakdown
- Sequential per-outlet invoice numbering (`<PREFIX>/<FY>/<NNNNN>`)
- 5 reusable infra packages: `shared`, `auth`, `tenancy`, `tax`, `printing`, `events`

### 🚧 In progress / immediate gaps

- `bdfce166` — **Offline-first architecture decision** (the gap Petpooja already won — blocks pilot)
- `c8e499ed` — Multi-cashier shift handoff via 4-digit PIN
- `041caa9c` — Front-end stack ADR + `apps/captain-pwa` scaffolding
- `d735b90c` — POS hardware compatibility matrix
- `cfc88eff` — GST e-invoicing IRN + QR for B2B invoices
- `5a3f8ee3` — Captain PWA shell — offline-first sync queue
- `c608c7b6` — ESC/POS rendering goldens + Kannada/Arabic codepage handling
- `9e4e0903` — Ordering module BullMQ adapter + drizzle persistence

### 🔮 Planned epics by project

**MVP project (`59146635`):**
- Mangalore beachhead 50 outlets, Owner companion app v1, Web POS (PWA) v1,
  Outlet onboarding 12-point check, Menu authoring, KOT printing, Counter
  billing, GST e-invoicing.

**KAR (`54782a7f`):** Mysuru, Hubballi-Dharwad, Belagavi, Udupi rollouts;
Onboarding playbook v2.

**AGG (`fd76e55e`):** Swiggy / Zomato partner integrations; Sync observability + reconciliation.

**SAU (`63ce5db3`):** Jahez integration, HungerStation integration, Arabic
localization (RTL + i18n), ZATCA Fatoora Phase-2, KSA entity setup, Riyadh
pilot 30 outlets.

**CHN (`d1e1741a`):** Discovery: chain pain points; Central kitchen + multi-outlet feasibility.

**PLAT (`35295a9e`):** Cloud foundation (India + KSA), Public API gateway,
Outlet identity service, Order pipeline, Observability + SLOs, Data warehouse,
Notifications (WhatsApp + SMS), Self-serve onboarding portal.

---

## 12. Org structure — who reviews what (in precise)

These are the canonical org units and roles. Use them when assigning work or
labeling design reviews.

### Org units (precise EO)
- **Engineering** (L0): Platform & Infra (L1), POS Engineering (L1), Aggregator Integrations (L1), Data & Reporting (L1)
- **Product** (L0): Product Management (L1), Design (L1)
- **Sales** (L0): India Field Sales (L1), Saudi Sales (L1)
- **Customer Success** (L0): Onboarding (L1), Support (L1)
- **Finance & Compliance**, **Marketing**, **Office of the CEO**

### Roles relevant to design
- **Designer** (`2ff0bf89`) — owns Design System and per-surface visuals
- **Product Manager** (`a1e624bb`) — frames the user problem, signs off on flows
- **Head of Platform Engineering** (`797a7c68`) — reviews PWA-shell decisions
- **Head of POS Engineering** (`4f460fc8`) — reviews captain/cashier flows
- **Head of Customer Success** (`b5323c81`) — vetoes flows that won't survive a real owner

### Five named AI agents (per-domain ownership; semantic, attribution currently broken — see precise ticket `0b55a02d`)

| precise id | Agent | Owns |
|---|---|---|
| `8bd2d457` | `odr-platform-architect` | Monorepo health, cross-cutting packages, CI, RLS |
| `9fa9f966` | `odr-billing-engineer` | Billing, tax, GST e-invoicing, payments |
| `743ff180` | `odr-ordering-engineer` | Ordering FSM, KOT, kitchen display, inventory |
| `baa975d5` | `odr-printing-engineer` | `@odr/printing`, ESC/POS, Tauri sidecar |
| `5675ec84` | `odr-ux-engineer` | `apps/web`, `apps/captain-pwa` |

---

## 13. Compliance + technical constraints designs must respect

| Standard | Requirement | Design implication |
|---|---|---|
| **GST Act 2017** | GST-compliant invoicing | Bill must show per-`(component, rate)` breakdown — e.g. `CGST @ 2.5%`, `CGST @ 9%`, `SGST @ 2.5%`, `SGST @ 9%` as separate rows for mixed-rate orders. Already implemented in API. |
| **GST e-invoicing (IRN+QR)** | Required for B2B invoices > ₹500K | Bill print template must reserve space for IRN + QR on B2B receipts. Toggleable. |
| **DPDP Act 2023** | Data privacy and consent | Diner Table-QR app must show explicit consent before storing PII (name/phone). Export + delete affordance everywhere personal data lives. |
| **ZATCA Phase 2** | Saudi e-invoicing | Bill template must include Saudi VAT breakdown + ZATCA-required QR (Base64 TLV) on receipts in KSA outlets. |
| **Internal: tenant isolation via RLS** | All tenant-scoped queries enforced at DB | UI must never accept a tenantId from URL/query params; tenant always derived from JWT context. |
| **Multi-cashier (planned)** | Shift handoff via PIN | PIN entry screen must work without re-typing email; should appear on outlet-level "lock screen" after auto-timeout. |
| **Indic + Arabic typography** | Kannada, Hindi, Tamil, Marathi, Gujarati, Arabic (RTL) | Receipts that can't represent a glyph in ESC/POS codepage must rasterize to image. Screen UI uses system fonts that handle the script. |

---

## 14. Critical "do not" rules for any UI work

1. **Never round currency in the UI itself.** All amounts arrive from the API as `*_minor` strings (bigint paise/halala). Display formatting only. Don't `parseFloat`.
2. **Never let the UI compute tax.** Tax breakdowns come from the API's `taxBreakdown` array. The UI renders them.
3. **Never store `tenantId` in localStorage as the source of truth.** It's in the JWT; trust the JWT.
4. **Never show a dialog that locks the captain when network drops.** Offline must be a calm status indicator, not a blocker (this is the entire Petpooja-parity bet).
5. **Never use spinners for KOT fire / settle.** These are <100ms locally + queued for sync. Optimistic UI with a status pill.
6. **Never collapse multi-rate tax into one line.** GST compliance requires per-`(name, rate)` breakdown rows.
7. **Never write a custom design system.** Use shadcn + Tailwind tokens. Year 1 explicit constraint.
8. **Never use Next.js for the captain PWA.** SSR is irrelevant for a 12-hour shift app and incompatible with offline.

---

## 15. Where to dig deeper (precise queries)

```bash
# strategy
precise sbm strategy get 7f871d18

# competitor reference
precise sbm context get 05584cbd

# tech-stack ADR
precise sbm context get 44b5b240

# personas (see section 3)
precise sc persona get <shortId>

# enterprise assets (52 entries)
precise ea asset ls --all
precise ea asset get <shortId>

# work packages
precise wk wp ls --page-size 100
precise wk wp ls --project-id 59146635   # MVP project
precise wk wp ls --assignee-id <agent-uuid>

# initiatives + metrics
precise sbm initiative ls
precise sbm metric ls
```

---

*This brief was generated 2026-05-05 by extracting the Odr tenant on the
precise platform. Re-generate when major changes happen — strategy update,
new initiative, persona refresh, or competitor research update.*
