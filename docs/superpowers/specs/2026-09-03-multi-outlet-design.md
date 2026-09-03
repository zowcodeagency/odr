# Odr multi-outlet: one brand, many outlets

Date: 2026-09-03 · Status: implemented 2026-09-03 (see plans/2026-09-03-multi-outlet.md)

## Goal

Let a restaurant brand with several outlets run all of them on Odr: owners
and managers switch between outlets in one tap, floor staff are pinned to the
outlet they work at, the brand keeps one menu (or not, per outlet), sales roll
up across outlets, and the Odr team adds outlets from the admin console
because pricing is per outlet.

## Where we start

- `tenants → outlets` is already 1:N. Tables, orders, KOTs, bills and invoice
  numbering are per outlet. Menu rows have `outlet_id NULL` (master, seen by
  every outlet) or a UUID (outlet-specific).
- The captain PWA hardcodes `outlets[0]` at login. Every screen reads
  `session.outletId`. There is no switcher and no outlet list anywhere.
- Memberships are `(tenant, user, role)` — nothing pins a person to an outlet.
- `menu_items.is_active` is global: sold out at one outlet hides the dish at
  every outlet.
- Gaps: ordering `openTable` never checks the outlet belongs to the tenant; the
  PWA menu editor creates categories with `outletId` set, so a second outlet
  would see a half-empty menu.

## Decisions (locked)

- **Scope:** owner and manager see every outlet and switch; captain, cashier,
  kitchen are pinned to exactly one outlet.
- **Menu:** chosen when the Odr team creates the outlet. `shared` = the brand's
  one menu with per-outlet sold-out marks. `own` = an independent menu that the
  Odr team imports for that outlet.
- **Outlet creation:** Odr team only (admin console). Owners edit name, GSTIN,
  address, invoice prefix, tables and printer in the app.
- **Reports:** Sales screen gets a "This outlet / All outlets" toggle for
  owner and manager.
- Outlet is chosen client-side and sent on every call as today; the server
  enforces the pin from the membership row (no outlet in the JWT).

## Data model (one drizzle migration, `0008`)

```
memberships
  + outlet_id uuid null references outlets(id) on delete set null
    -- NULL = every outlet (owner/manager only; enforced in identity service)
    -- backfill: for role not in (owner, manager) set outlet_id = the tenant's
    -- earliest outlet

outlets
  + is_active boolean not null default true
  + menu_mode text not null default 'shared'   -- 'shared' | 'own'
  + unique (tenant_id, code)
  + unique (id, tenant_id)                     -- target for composite FKs

menu_item_soldout                              -- presence = sold out here
  tenant_id uuid not null references tenants(id) on delete cascade
  outlet_id uuid not null references outlets(id) on delete cascade
  item_id   uuid not null references menu_items(id) on delete cascade
  primary key (outlet_id, item_id)

composite FKs (outlet_id, tenant_id) → outlets(id, tenant_id) on:
  orders, kots, bills, tables, menu_categories, menu_items, memberships
  -- closes the cross-tenant outlet hole with zero app code
```

Drizzle: `foreignKey({ columns: [t.outletId, t.tenantId], foreignColumns: [outlets.id, outlets.tenantId] })`
in each table's extra-config array. Existing single-column FKs stay.

## API (apps/api)

### Tenancy / auth

- `membershipRoleOf` (packages/db) returns `{ role, outletId }`; the auth
  middleware puts `outletId` into `RequestContext` (field already exists).
- `@odr/tenancy` gains one pure helper:
  ```ts
  /** Pinned staff may only touch their own outlet. Unpinned pass. */
  export const assertOutletScope = (outletId: string): void
  // throws ForbiddenError("outlet out of scope") when ctx.outletId && ctx.outletId !== outletId
  ```
  Called by: outlets (byId, updateSettings, ensurePublicToken, listTables,
  addTables), ordering (openTable, listOpen, listPendingKots), billing (list,
  settle via order.outletId), menu (list*, soldout toggle), printing (test).

### Outlets

- `GET /outlets` → accessible outlets only (pinned: just theirs), active first,
  then by name. Each row adds `isActive`, `menuMode`.
- `PATCH /outlets/:id` schema extended: `name`, `gstin` (validated), `address`,
  `invoicePrefix` alongside the printer fields. Needs `outlet:write`.
- Service refuses `openTable` on an inactive outlet (`ConflictError`).

### Menu

- Reads with `outletId`: look up the outlet's `menu_mode`.
  `shared` → `outlet_id IS NULL OR outlet_id = $o`; `own` → `outlet_id = $o`.
  Items carry `isActive = item.is_active AND NOT soldout(outlet, item)` so the
  captain order screen, editor and diner app keep reading one flag.
  `GET /menu/items?outletId=` also returns `soldOutHere: boolean` for the editor.
- Writes with `outletId`: service maps `shared` → store `outlet_id NULL`,
  `own` → store the outlet id. Client always sends the outlet it is on.
- `PUT /menu/items/:id/soldout` body `{ outletId, soldOut: boolean }` →
  insert/delete the `menu_item_soldout` row. Gated by `menu:write`
  (owner/manager), matching today's editor gate.
- Reads without `outletId` (admin import) unchanged: every row.

### Identity / staff

- `POST /staff` body adds `outletId?: string`. Required when role is not
  owner/manager (`ValidationError`), ignored (stored NULL) otherwise. Outlet
  must belong to the tenant.
- `GET /staff` rows add `outletId`, `outletName`.
- `login` response unchanged.

### Billing

- `GET /billing/bills`: `outletId` optional. Omitted → every outlet in the
  tenant; pinned staff calling without it get `ForbiddenError`. Rows already
  carry `outletId`.

### Admin (`/admin`, ADMIN_KEY / Supabase)

- `GET  /restaurants/:tenantId/outlets`
- `POST /restaurants/:tenantId/outlets` body
  `{ name, code?, gstin?, address, invoicePrefix?, menuMode: 'shared'|'own' }`
  (code defaults to a slug of the name, upper-cased, uniqueness retried with a
  suffix like tenant slugs).
- `PATCH /restaurants/:tenantId/outlets/:outletId` body `{ isActive }`.
- `POST /restaurants/:tenantId/menu/import` body adds `outletId?` → imports
  into that outlet's own menu (categories matched within that outlet).
- `GET /restaurants` rows add `outletCount`.
- `createRestaurant` unchanged (still creates the first outlet, `shared`).

## Captain PWA (apps/captain-pwa)

- **Session** adds `outlets: { id, name }[]` (accessible list) so the shell
  knows whether to show a switcher without a round-trip. `localStorage
  odr.lastOutlet` remembers the last pick per device.
- **Login:** after token → `GET /outlets`. One → straight in. Several → if
  `odr.lastOutlet` is among them use it, else show "Choose an outlet" (same
  visual as the existing "Choose a restaurant" step). Zero → existing error.
- **Switcher:** `Topbar` outlet name becomes a button when
  `session.outlets.length > 1`; opens the `@odr/ui` `Sheet` listing outlets
  with the active one marked. Picking one: fetch that outlet, `patchSession`
  with the outlet fields, store `odr.lastOutlet`, dispatch
  `window.dispatchEvent(new Event("odr:session"))`; `App` listens and re-reads
  the session so every route's `useAsync([session.outletId])` refetches.
- **Sales (`bills.tsx`):** segmented control "This outlet | All outlets" shown
  when `session.outlets.length > 1` and `canManage(role)`. All-outlets calls
  `api.bills()` without outlet, shows a per-outlet totals strip above the
  list, and prefixes each row with the outlet name.
- **Settings:** new first tab "Outlet" — name, GSTIN, address lines, invoice
  prefix → `PATCH /outlets/:id`; on success `patchSession` so bills print the
  new header. Staff tab: outlet `<select>` visible for pinned roles, default
  current outlet; list shows outlet name per person.
- **Menu editor:** sold-out toggle → `PUT /menu/items/:id/soldout` with the
  current outlet. Subtitle says "Shared brand menu · sold-out is per outlet"
  or "This outlet's own menu".
- **More:** identity card shows outlet; nothing else.
- Diner app, KDS, order, tables, QR: unchanged (all already keyed on
  `session.outletId` / QR outlet).

## Admin console (apps/admin)

- Restaurant list: outlet count column.
- Drawer: new "Outlets" section above payments — table of outlets (name,
  code, city, menu mode, active toggle) and an "Add outlet" form (name, GSTIN,
  address, invoice prefix, radio "Share the brand menu / Own menu").
- Import menu: when the restaurant has any `own` outlet, a target select
  "Shared brand menu" or the outlet.

## Error handling

- Out-of-scope outlet → 403 `FORBIDDEN` (existing error shape). PWA shows the
  toast.
- Inactive outlet: hidden from pickers; `openTable` → 409.
- Pinned role without `outletId` on staff create → 400 with `issues`.
- Composite FK violation surfaces as the existing 500 → treat as a bug.

## Testing (bun test, fake repos like the existing module tests)

- tenancy: `assertOutletScope` passes unpinned, passes matching, throws other.
- menu: shared mode stores NULL outlet; own mode stores outlet; `isActive`
  false when a soldout row exists for that outlet only.
- identity: captain without outlet → ValidationError; manager ignores outlet.
- billing: pinned staff `list()` without outlet → Forbidden.
- outlets: inactive outlet hidden from `list()`; `openTable` refuses inactive.
- captain-pwa `session.test.ts`: `pickOutlet(outlets, last)` prefers the
  remembered outlet, falls back to the only one, returns null for several.

## Deliberately skipped (add when a customer asks)

- Per-outlet pricing (`menu_item_soldout` can grow a `price` column).
- Staff at more than one outlet (membership `outlet_id` → junction table).
- Moving staff between outlets (remove + re-add today).
- Consolidated reports beyond the sales list; realtime.
- Owner self-serve outlet creation (admin only — billing is per outlet).
