/*
 * Bun.serve for the Captain PWA — the same file in dev and in production.
 *
 * Bun's HTML route serves index.html and bundles the imported tsx/css; with
 * NODE_ENV=production it emits a minified, hashed build instead of the hot
 * one (per locked stack ADR-001 — no Vite, no webpack).
 *
 *   dev:   bun --hot src/server.ts                 → http://localhost:3001
 *   prod:  NODE_ENV=production ODR_API=… bun src/server.ts
 *
 * Env: PORT, ODR_API (the API origin to proxy to), DINER_ORIGIN (where the
 * table QR codes point).
 */

import index from "./index.html";

const PORT = Number(process.env["PORT"] ?? 3001);
const API = process.env["ODR_API"] ?? "http://localhost:3000";
const DINER_ORIGIN = process.env["DINER_ORIGIN"] ?? "";
const DEV = process.env["NODE_ENV"] !== "production";

/*
 * Runtime config, not build-time. Bun does not inline env into the client
 * bundle, and printed QR codes must point at the real diner host — so the
 * server hands it over and one image serves every deployment. Fetched by
 * main.tsx at boot; a <script src> in index.html is not an option, the HTML
 * bundler tries to resolve it as a build asset.
 */
const config = Response.json(
  { dinerOrigin: DINER_ORIGIN },
  { headers: { "cache-control": "no-store" } },
);

const manifest = new Response(
  await Bun.file(`${import.meta.dir}/../public/manifest.webmanifest`).bytes(),
  { headers: { "content-type": "application/manifest+json" } },
);

// Brand assets need stable URLs (the manifest and the favicon point at them),
// so they are served rather than bundled with a content hash.
const icon = new Response(
  await Bun.file(`${import.meta.dir}/../public/icon.png`).bytes(),
  { headers: { "content-type": "image/png", "cache-control": "max-age=86400" } },
);

const server = Bun.serve({
  port: PORT,
  development: DEV,
  routes: {
    "/": index,
    "/config.json": () => config.clone(),
    "/manifest.webmanifest": () => manifest.clone(),
    "/icon.png": () => icon.clone(),
  },
  // Proxy the API so the browser stays same-origin — no CORS allowlist to
  // keep in sync, and the token never crosses an origin boundary.
  fetch(req) {
    const url = new URL(req.url);
    if (
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/auth/") ||
      url.pathname.startsWith("/public/") // dish photos
    ) {
      return fetch(new Request(`${API}${url.pathname}${url.search}`, req));
    }
    // Static docs pages (public/docs/*.html) — shareable links, no login.
    // In production Workers assets serves them; this mirrors its "auto"
    // html handling so /docs/roles works without the extension in dev too.
    if (/^\/docs\/[\w-]+(\.html)?$/.test(url.pathname)) {
      const name = url.pathname.replace("/docs/", "").replace(/\.html$/, "");
      const file = Bun.file(`${import.meta.dir}/../public/docs/${name}.html`);
      return file
        .exists()
        .then((ok) =>
          ok
            ? new Response(file, { headers: { "content-type": "text/html; charset=utf-8" } })
            : new Response("Not found", { status: 404 }),
        );
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(
  `▸ Odr Captain  http://localhost:${server.port}  (${DEV ? "dev" : "production"}, api ${API})`,
);
