# Odr — repo rules for Claude

## Docs travel with features
Every user-facing change ships with its docs in the same commit:
- `apps/captain-pwa/public/docs/features.html` — the one-page "Everything Odr does"
  (live at https://odr-captain.zowcode.workers.dev/docs/features). Update the
  relevant feature card, bump "Last updated", and add a row to "What's new".
- `docs/handbook/odr-handbook.html` — the staff handbook; regenerate the PDF with
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer --print-to-pdf="$PWD/docs/handbook/Odr-Handbook.pdf" "file://$PWD/docs/handbook/odr-handbook.html"`.
- `apps/captain-pwa/public/docs/roles.html` when permissions change.
- A new guide gets its own `public/docs/<name>.html` AND a card in `public/docs/index.html`
  (the /docs grid), plus a footer link from the sibling pages.
Plain words, no jargon — these pages are read by restaurant owners.

## Deploy
Cloudflare account zowcode@gmail.com (961f107c2d06f83f5de703f15cd99553), four Workers:
odr-api, odr-captain, odr-diner, odr-admin. Order: `bun run db:migrate` (user runs it —
never from an agent against `.env`) → `apps/api` `wrangler deploy` → `bun run build:web`
with `DINER_ORIGIN=https://odr-diner.zowcode.workers.dev` → `wrangler deploy` each app.

## Commits
Conventional type prefix (commitlint enforces the scope list in
`commitlint.config.js`). One squashed commit per feature, plain message, no
Co-Authored-By or session trailers.
