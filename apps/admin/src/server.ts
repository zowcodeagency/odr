/*
 * Bun.serve dev server for the internal admin page.
 *
 * Must be started with apps/admin as cwd so bunfig.toml's tailwind plugin
 * loads:  bun --cwd apps/admin dev  →  http://localhost:3002
 */

import index from "./index.html";

const PORT = Number(process.env["PORT"] ?? 3002);

const server = Bun.serve({
  port: PORT,
  development: true,
  routes: { "/": index },
  fetch() {
    return new Response("Not found", { status: 404 });
  },
});

console.log(`▸ Odr Admin  http://localhost:${server.port}`);
