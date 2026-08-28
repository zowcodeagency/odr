# Subscription lifecycle + internal admin + PWA restyle

Date: 2026-08-24 · Status: approved by Ahmed

## Goal

Odur is sold manually: our team creates each restaurant's account, sets a
subscription window, and records payments ("top-ups") after phone calls.
The system enforces the dates. No payment gateway, no self-signup, no AI.

Three workstreams, independently buildable:

- **A — Backend**: subscription columns + topups table, enforcement
  middleware, `/admin/*` API (create restaurant, list, top-up, menu import).
- **B — Captain PWA restyle**: English only, dark + light themes,
  clean-neutral minimal design (Linear/Stripe feel).
- **C — Admin page**: new `apps/admin`, one internal page for the team.

## A — Backend

### Schema (packages/db)

- `tenants` gains `subscription_start date` and `subscription_end date`
  (nullable — null means no enforcement, existing demo tenants keep working).
- New `topups` table: `id uuid pk`, `tenant_id fk`, `amount_minor numeric(20,0)`,
  `months_added int`, `note text null`, `created_at timestamptz default now()`.
- Recording a top-up extends `subscription_end`: from **max(today, current end)**
  plus `months_added`. Expired tenants resume from today, active ones stack.

### Enforcement (apps/api)

- Auth middleware (where tenant context is established) rejects requests for
  tenants past `subscription_end` with `403 {"error":"SUBSCRIPTION_EXPIRED"}`.
- Login for an expired tenant also returns `403 SUBSCRIPTION_EXPIRED`.
- Login/`/me` responses include `subscriptionEndsAt` (ISO date or null) so
  clients can show a warning banner from 7 days out.

### Admin API (`/admin/*` routes in apps/api)

Auth: `authorization: Bearer <ADMIN_KEY>` where `ADMIN_KEY` comes from `.env`.
Constant-time comparison. 401 otherwise. These routes bypass tenant JWT auth.

- `POST /admin/restaurants` — `{name, ownerEmail, ownerPassword, ownerFullName,
  startDate, months, gstin?}` → creates tenant + default outlet (named after the
  restaurant) + owner user + membership, sets subscription window. Returns ids.
- `GET /admin/restaurants` — list with `subscriptionEnd`, `daysRemaining`,
  `status: active | expiring (≤7d) | expired | none`.
- `POST /admin/restaurants/:tenantId/topups` — `{amount, monthsAdded, note?}`
  (amount in rupees, stored as minor units) → inserts topup, extends end date,
  returns new `subscriptionEnd`.
- `GET /admin/restaurants/:tenantId/topups` — payment history.
- `POST /admin/restaurants/:tenantId/menu/import` — bulk menu import:
  - JSON body: `{categories: [{name, items: [{name, price, taxClass?, isVeg?,
    description?}]}]}` — `price` in rupees as string or number; `taxClass`
    defaults to `GST_5`.
  - CSV body: `{csv: "category,name,price,taxClass,isVeg,description\n..."}`
    — same defaults.
  - Idempotent-ish: categories matched by name (create if missing); items
    always created. Returns counts `{categories, items}`.
  - Runs inside the tenant's request context so the existing menu service/repo
    does the writes — no duplicate menu logic.

### Tests (bun test)

- Top-up date math: expired-resumes-from-today, active-stacks, null-start.
- Enforcement: active passes, expired 403s, null dates pass.
- Menu import: JSON and CSV parse, taxClass default, category reuse.

## B — Captain PWA restyle (apps/captain-pwa + packages/ui)

- **English only**: delete `lib/i18n.ts` and the EN/हि/ع switcher; remove
  Fraunces + Arabic + Devanagari font loads from index.html. Keep IBM Plex
  Sans (+ Mono for numbers).
- **Themes**: full token sets for dark AND light in packages/ui tokens.
  `data-theme="dark|light"` on `<html>`, default follows
  `prefers-color-scheme`, toggle in the top bar, persisted to localStorage.
- **Clean neutral**: one accent color, hairline borders, generous whitespace,
  no serif display font, no ornaments. Same five screens (login, tables,
  order, KDS, bill), same layout bones and fixture data — new skin only.
- **Subscription UX**: warning banner when `subscriptionEndsAt` ≤ 7 days away;
  full-screen "Subscription ended — contact Odur" state. Driven by a value in
  the auth store (fixture now, API later).

## C — Admin page (new apps/admin)

- Mirrors captain-pwa's Bun.serve + bunfig tailwind setup, port 3002,
  `dev:admin` script at root (`bun --cwd apps/admin dev`).
- Single page, same clean-neutral design language, dark + light.
- Gate: ADMIN_KEY input → stored in localStorage → sent as bearer to
  `/admin/*` (proxy or direct to :3000 with CORS — pick simplest).
- Sections: restaurant list (status color per spec A), create-restaurant form,
  per-restaurant drawer with top-up form + payment history + menu import
  (textarea for pasted JSON, file/paste for CSV, shows import counts).

## Out of scope

Payment gateway, self-signup, AI menu extraction, read-only grace mode,
admin user accounts (ADMIN_KEY only), wiring PWA screens to the live API.
