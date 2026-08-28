# Odr go-live: live wiring, waiter mobile, QR diner ordering, printing, channels

Date: 2026-08-24 · Status: approved by Ahmed ("develop this and make it very simple")

## Goal

Make the whole product functional against the real database so a Mangaluru
restaurant can replace Petpooja tomorrow: waiters take orders on phones,
diners order via table QR codes, parcels and Zomato/Swiggy orders flow
through the same kitchen display, bills print on the thermal printers
restaurants already own. No payments anywhere — cash counter only.

Four workstreams. A's API contract below is FROZEN — B and C build against
it in parallel.

## Decisions (locked)

- Waiter surface = the captain PWA made fully responsive (390px phones up).
  No separate waiter app.
- Printing = browser print with real 58mm/80mm thermal CSS (works with any
  installed printer) + optional network ESC/POS kitchen printer via the
  existing `@odr/printing` package (outlet setting: IP + port).
- QR ordering = new public diner app `apps/diner` (:3003). No login, no
  payment ("Pay at the counter"). Security = per-outlet random
  `public_token` embedded in the QR URL.
- Aggregators = manual quick entry (channel + reference), NOT partner APIs.
- Order channels: `dine_in | parcel | zomato | swiggy | other | qr`.
- KDS + tables refresh by polling every 5s. Realtime later if polling hurts.
- English only, dark + light, clean-neutral design language everywhere.
  Diner app may use a warmer, appetizing accent (menu is a food surface):
  keep layout minimal; veg/non-veg badges follow the Indian green/red
  square convention.

## A — Backend (apps/api, packages/db)

### Schema

- `tables`: `id uuid pk`, `outlet_id fk`, `label text`, unique(outlet_id, label).
- `outlets` add: `paper_width int not null default 80` (58|80),
  `printer_ip text null`, `printer_port int not null default 9100`,
  `public_token text null`.
- Persist the ordering domain: `orders`, `order_lines`, `kots` tables whose
  columns mirror the existing in-memory domain model (read
  `modules/ordering/domain.ts` first; the drizzle repo replaces
  the in-memory adapter as the wired implementation). `orders` additionally
  carries `channel text not null default 'dine_in'`,
  `customer_name text null`, `aggregator_ref text null`.

### API additions (frozen)

Auth:
- `POST /auth/login {email, password, tenantId?}` — tenantId now optional.
  Sole membership → login as before. Multiple → `200 {requiresTenant: true,
  tenants: [{id, name}]}` and the client re-posts with tenantId.

Authed (`/api/v1`, existing JWT + subscription gate; role checks per RBAC):
- `GET /staff` → `{staff: [{id, email, fullName, role}]}`;
  `POST /staff {email, password, fullName, role}` (owner/manager only).
- `GET /outlets/:outletId/tables` → `{tables: [{id, label}]}`;
  `POST /outlets/:outletId/tables {labels: string[]}` (bulk, idempotent by
  label); `DELETE /tables/:id`.
- `PATCH /outlets/:id {paperWidth?, printerIp?, printerPort?}`.
- `POST /outlets/:id/qr-token` → `{publicToken}` (get-or-create random).
- `POST /ordering/orders {outletId, tableLabel?, channel?, customerName?,
  aggregatorRef?}` — tableLabel required only for dine_in.
- `GET /ordering/orders?outletId=X&open=true` → `{orders: [{id, tableLabel,
  channel, customerName, aggregatorRef, status, totalMinor, lineCount,
  createdAt}]}` (open = not settled/voided).
- `GET /ordering/kots?outletId=X&pending=true` → `{kots: [{id, orderId,
  number, tableLabel, channel, firedAt, lines: [{itemName, qty, note}]}]}`.
- `POST /ordering/kots/:id/done` — kitchen bump. Add a done/ready mark to
  the domain if it lacks one.
- `POST /print/kots/:id`, `POST /print/bills/:id` — render via
  `@odr/printing` to the outlet's network printer; `204` on success,
  `409 {"error":"NO_PRINTER"}` when unconfigured/unreachable.

Public (no JWT, CORS `*`, all validate `token` === outlet.public_token,
404 on mismatch):
- `GET /public/outlets/:outletId/menu?token=T` → `{outlet: {name},
  categories: [{id, name, items: [{id, name, price, priceMinor, isVeg,
  description}]}]}`.
- `POST /public/outlets/:outletId/orders {token, tableLabel, customerName?,
  lines: [{itemId, qty, note?}]}` → `{orderId, code}` where code is a short
  human code (e.g. last 6 of id). Prices/names resolved server-side from the
  menu — never trust client prices. Creates an open order, channel `qr`.
- `GET /public/orders/:id?token=T` → `{status, tableLabel, totalMinor,
  lines: [{itemName, qty}]}`.

Rate-limit public order placement (in-memory token bucket per outlet is
fine — ponytail-comment the ceiling).

### Tests
Drizzle repo FSM round-trip (open → add lines → fire → settle) against pure
logic where possible; public price resolution (client price ignored);
channel validation; qr-token idempotency.

## B — Captain PWA wiring + waiter mobile (apps/captain-pwa, packages/ui)

- Replace ALL fixtures with live API via the existing `lib/api.ts` wrapper
  (it was built for this swap). Delete fixture files when nothing reads them.
- Login: email + password → handle `requiresTenant` with a tenant picker;
  store token; banner + expired lock screen driven by `subscriptionEndsAt`
  from the live response.
- Tables screen: live open orders grouped by table + the outlet's defined
  tables (free ones from `GET tables`), channel badges (QR orders arrive
  here as new open orders on their table); stats row computed from data.
- Order pad: live menu (categories + items), add lines, fire KOT, settle →
  bill via existing billing endpoint. Works one-handed on a 390px phone —
  cart as a bottom sheet on mobile.
- Parcel & aggregator: an "Off-table" entry point next to Open table —
  channel picker (Parcel / Zomato / Swiggy / Other), customer name or order
  ref, then the same order pad. Tables screen shows them in an "Off-table"
  strip.
- KDS: poll `GET kots?pending=true` every 5s, bump button → `kots/:id/done`,
  optional auto-print on fire when network printer configured.
- Settings screen (owner/manager): staff list + add; tables list + add many
  ("T-1 to T-12") + per-table QR — generate with the `qrcode` package
  (already added to package.json) encoding
  `http://localhost:3003/#/o/<outletId>/t/<label>?k=<publicToken>`, with a
  print-sheet view (one A4 grid of QR cards); printer settings (paper width
  58/80 select, kitchen printer IP/port, test print button).
- Print CSS: `@media print` stylesheets for bill and KOT sized by the
  outlet's paper width (58mm ≈ 48mm printable / 80mm ≈ 72mm printable),
  monospace, no nav. Print button = `window.print()`; network print button
  calls the print endpoints and falls back with a toast on NO_PRINTER.
- Mobile: verify every screen at 390px width in the browser (resize), touch
  targets ≥44px, bottom-sheet cart, no horizontal scroll.

## C — Diner QR app (new apps/diner, :3003)

- Same Bun.serve + tailwind setup as apps/admin (package.json already
  scaffolded); `dev:diner` script at root. Hash routes:
  `#/o/:outletId/t/:label?k=token`.
- Screens: menu (outlet name header, category chips, item cards with veg/
  non-veg square badge, price, description; sticky cart bar), cart sheet
  (qty steppers, item notes, name field optional), confirm → order placed
  (big order code, "Show this at the counter · Pay at the counter — cash or
  UPI"), status poll every 8s (Placed → In kitchen → Served/Settled).
- Design: mobile-first 375px, generous type, appetizing warm accent
  (#DC2626 family) on clean neutral surfaces, Karla for UI text (Google
  Fonts) — keep it minimal, no carousel/hero bloat. Light + dark via
  prefers-color-scheme (no toggle — diners won't look for one).
- Invalid/missing token → friendly "menu unavailable, ask the staff" screen.
- No login, no payment UI anywhere.

## R — Competitive research (docs/research/competitors.md)

Petpooja, Posist, DotPe, Rista (+ anything found): what they charge, their
onboarding pain, top user complaints, feature bloat vs what small Mangaluru
restaurants actually use. Output: one markdown file — feature table, 10
concrete "Odr stands out by..." recommendations ranked by effort/impact.
Non-blocking: informs copy and the next iteration, not this build.

## Out of scope

Payment gateways, real Zomato/Swiggy APIs, offline-first sync queue,
inventory, reports dashboards, RLS, multi-outlet switching UI, Hindi/Arabic.
