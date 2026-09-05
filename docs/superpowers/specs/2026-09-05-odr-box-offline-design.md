# Odr Box — the fully offline install

Date: 2026-09-05. Status: approved by Ahmed 2026-09-05; implementation on branch `box`.

## Why

Some restaurants want no internet dependency and no data in the cloud. We hand them one
program, install it once, and charge yearly or monthly by license key. No hosting cost per
customer. The cloud product stays the default; the Box is for customers who ask for it.

## Decision

One codebase, one more entry point. The Box is the existing API and staff app started
differently, with the database driver swapped. No fork.

Verified facts this rests on (checked 2026-09-05 against the repo):

- The API runs as a plain Bun process today (`apps/api/src/server.ts`). Only
  `apps/api/src/worker.ts` knows about Cloudflare.
- Every module reaches Postgres through `packages/db/src/index.ts`. The installed Drizzle
  0.45.2 ships the `pglite` driver. Schema, 11 migrations and repo code are unchanged by the
  swap. Two raw SQL fragments in the API, no row-level-security policies.
- The only outbound internet call is the admin console's Supabase login. Not used on site.
- Kitchen printers are reached by TCP on port 9100 (`packages/printing`). Browser print
  needs no network.
- Subscription end is checked on every request (`apps/api/src/middleware/auth.ts`,
  `tenants.subscription_end`); the expired screen already exists in the staff app.
- Login is local: HS256 JWT with a local secret, PBKDF2 passwords.
- Fonts load from Google (`apps/captain-pwa/src/index.html`): must be bundled.
- Diner QR ordering needs customers to reach our diner site: not available offline.

## Shape

```
 Restaurant wifi (internet optional)
 ┌──────────────────────────────────────────────────────────┐
 │  Odr Box (one executable, always on)                      │
 │   ├─ API (Hono, Bun)                                      │
 │   ├─ staff app (built PWA, served as static files)        │
 │   ├─ PGlite database  →  <data>/db/                       │
 │   └─ updater, backup, license                             │
 │        ▲            ▲             ▲             ▲         │
 │   captain phone   kitchen tablet  owner's PC   LAN printer│
 └──────────────────────────────────────────────────────────┘
```

Single-counter use (one person, one PC) is the same build used in a browser on the Box
itself. Not a separate product.

Hidden on the Box behind the one `offline` flag: diner QR ordering (needs the internet) and
"bills on the device" (the server is already in the building; phone-only bills would sit
outside every backup).

Hardware: the customer's Windows PC or laptop, or a Linux mini PC / Raspberry Pi 5 we
supply pre-installed. Targets built from one command: windows-x64, darwin-x64,
darwin-arm64, linux-x64, linux-arm64.

## Components

### 1. Database entry
`ODR_DB=pglite:<folder>` selects PGlite in `packages/db/src/index.ts`; anything else keeps
postgres.js. Migrations run from the same `packages/db/drizzle` folder on every start,
before the API listens. One process, one writer.

### 2. Box entry point
`apps/box/src/main.ts`: runs migrations, starts Hono on one port, serves the built staff
app from embedded assets with SPA fallback, proxies nothing (same origin). Config lives in
`<data>/config.json`: port, data folder, update channel. `config.json` served to the app
has `dinerOrigin: ""` and `offline: true`; the app hides the QR section when offline.

### 3. First-run setup
When no tenant exists the app shows a setup page: restaurant name, GSTIN, owner name,
email, password, tables. It calls the existing admin `createRestaurant` service through a
local-only route that is disabled once a tenant exists. No admin console on site.

### 4. License
A license is a compact signed token (Ed25519, `jose` is already a dependency): tenant
name, license id, expiry date, plan, and the **install id** of the one Box it is for. The
install id is a random id the Box generates on first run and stores in its data folder; the
About screen shows it and the owner reads it to us when ordering a key. A key whose install
id does not match is refused, so one key cannot run two Boxes. Public key is baked into the
build; the private key stays with us in a small CLI (`dev/license.ts`). Entering a key
writes `subscription_end`.
Grace: 3 days after expiry billing still works under a full-width banner, then the
existing expired screen. Renewal banner in the last 7 days (existing). Keys arrive by
WhatsApp as text or QR; the Settings page has "Enter license key" and a camera scan.

### 5. Updates
Settings → About (owner only): version, license id and expiry, data folder, "Check for
updates", "Export backup". Manifest at `https://updates.<our domain>/<channel>.json`:

```json
{ "version": "1.4.0", "minVersion": "1.2.0", "notes": "…",
  "files": { "windows-x64": { "url": "…", "sha256": "…" }, "…": {} },
  "sig": "<Ed25519 over the manifest body>" }
```

Flow: fetch → verify signature (same key as licenses) → compare semver → download to
`<data>/updates/` → verify sha256 → offer "Update now" or "Update tonight" (time set at
install, default 04:00). Apply: copy `<data>/db` to `<data>/backup/pre-<version>/`, swap
binaries keeping `odr.previous`, restart. If the new binary fails to start twice, restore
`odr.previous` and the pre-update database and show the owner a message. Offline Boxes
update from a file the owner runs; same apply path. When a Box checks for updates it sends
`version` and `licenseId` so we know who runs what among connected customers.

`minVersion`: versions below it show a "must update" banner. Never blocks billing.

### 6. Versioning rules
- One version in the root `package.json`, stamped into the build with `define`.
- A git tag `vX.Y.Z` triggers the build of all five binaries and the manifest to the
  `pilot` channel; promotion to `stable` is a manual step after one pilot restaurant runs
  it for a week.
- Migrations are append-only; never edit or delete an applied migration. Column changes go
  expand → migrate data → contract across releases.
- Test suite gains one check: apply the full migration folder to an empty PGlite database,
  and to a database snapshot from the oldest supported Box release.
- API and staff app ship in one file, so phone and server versions can never differ.

### 7. Backup
Nightly copy of `<data>/db` to `<data>/backup/<date>/` (keep 14). If a removable drive
with an `odr-backup` folder is mounted, copy there too. "Export backup" zips the folder for
WhatsApp or a USB stick. "Restore" from a zip on the About screen. Installation is not
finished until the first backup exists.

### 8. Install
Windows: installer copies the exe, registers a Task Scheduler start-on-logon task, adds
the firewall rule, disables sleep, sets Windows Update active hours; `--windows-hide-console`.
Linux: systemd service with restart-on-failure. macOS: launch agent, signed build.
Phones open `http://<box-ip>:3000`; we print a card with the address and a QR of it.

### 9. Moving data
Same schema everywhere, UUID ids, so data moves as rows without renumbering.
- Box → new Box: "Export backup" on the old machine; the setup page on the new one offers
  "Restore from backup" before "New restaurant". The new machine has a new install id, so
  the old key does not work there: the owner calls us, we issue a key for the new id and
  revoke the old one from our records. Moving is therefore always done with our team, and
  a copied backup cannot become a second working Box.
- Cloud → Box: `dev/tenant-export.ts` dumps every row for one tenant id across all tables
  into the same backup format; the Box restores it. Invoice sequences continue.
- Box → cloud: the reverse import through the admin console (a later, separate step; the
  format is designed for it now).
Bills kept on a phone (hold-to-settle) are never part of this; the feature is hidden on
the Box.

### 10. Development and release control
- Build on branch `box`; merge to `main` once the spike passes and the pilot runs. After
  that the Box lives in `main` (`apps/box`, the database entry) next to the cloud code.
  No long-lived fork.
- The cloud deploys on every push. A Box release is a deliberate git tag; features already
  in `main` reach Boxes only when we cut and publish that tag. Features that must never
  appear on the Box are hidden behind the `offline` flag, not by separate code.

## Out of scope
Diner QR ordering, multi-outlet across sites, cloud sync of any kind, Android-only (no
PC) install. Each is a separate decision later.

## Risks
- PGlite in compiled Bun: VERIFIED 2026-09-05 on macOS (arm64) — all 12 migrations
  applied, round-trip ok; needs the embed variant (`pgliteWasmModule` + `initdbWasmModule` +
  `fsBundle` from `pglite.wasm`, `initdb.wasm`, `pglite.data` imported `with { type: "file" }`;
  PGlite 0.5.8). The finished Box binary (`bun run build:box`) was driven end to end on macOS
  over HTTP: setup → 201 then 409, owner login, outlets, tables, an order, and data intact
  after a restart. Windows x64 (136 MB), Linux x64 (120 MB) and Linux arm64 (120 MB) are built
  by cross-compile but NOT yet run on real hardware — that is the first thing the pilot does.
  Cross-compiled Windows builds show a console window (`--windows-hide-console` only works when
  compiling on Windows); the installer plan hides it via the scheduled task instead.
- Physical: PC asleep, router off, phones on the wrong wifi. Handled at install.
- Code visibility: the binary contains minified JS and can be extracted by a skilled
  person. Protection is the signed license and the contract, as with all offline software.

## Plan of work (about two weeks to a pilot)
1. ~~Spike~~ done 2026-09-05 (macOS; Windows/ARM builds pending a hardware run).
2. ~~Database entry + migrations on start~~ done (`packages/db/src/pglite.ts`).
3. ~~Box entry, embedded static app, offline flag, fonts bundled~~ done (`apps/box`, `dev/build-box.ts`).
4. ~~First-run setup~~ done (`/setup` route + setup screen).
5. License CLI, verify, enter/scan, grace, About screen. 1.5 days.
6. Updater with signature, rollback, nightly schedule. 2 days.
7. Backup, export, restore. 1 day.
8. Installers per platform, docs and handbook section. 1.5 days.
9. On-site test: two phones, kitchen tablet, LAN printer. 1 day.
