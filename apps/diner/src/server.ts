/*
 * Bun.serve dev server for the public diner (QR) app.
 *
 * Must be started with apps/diner as cwd so bunfig.toml's tailwind plugin
 * loads:  bun --cwd apps/diner dev  →  http://localhost:3003
 *
 * Every path serves the same document — the app is hash-routed, so the QR
 * URL (/#/o/:outletId/t/:label?k=token) never reaches the server anyway.
 */

import index from "./index.html";

const PORT = Number(process.env["PORT"] ?? 3003);

const server = Bun.serve({
  port: PORT,
  development: true,
  routes: { "/": index, "/*": index },
});

console.log(`▸ Odr Diner  http://localhost:${server.port}`);
