import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setDb } from "@odr/db";
import { openPglite } from "@odr/db/pglite";

/*
 * Everything the Box serves, on one port: the API, the staff app, runtime config.
 * `assets` maps a URL path ("/index.html", "/chunk-abc.js") to a file path the
 * compiled binary can Bun.file(); dev passes {} and proxies to the captain dev server.
 */
export const startBox = async (opts: { dataDir: string; port: number; assets: Record<string, string> }) => {
  mkdirSync(opts.dataDir, { recursive: true });

  // A per-install JWT secret, generated once. auth/tokens reads process.env at import,
  // so this must be set before the API module loads (hence the dynamic import below).
  const secretFile = join(opts.dataDir, "secret");
  if (!existsSync(secretFile)) writeFileSync(secretFile, crypto.randomUUID() + crypto.randomUUID(), { mode: 0o600 });
  process.env.JWT_SECRET ??= readFileSync(secretFile, "utf8").trim();

  const pg = await openPglite(join(opts.dataDir, "db"));
  try {
    setDb(pg.db);

    const { buildApp } = await import("@odr/api/app");
    const app = await buildApp({ setup: true });

    const config = JSON.stringify({ dinerOrigin: "", offline: true });
    const index = opts.assets["/index.html"];

    const server = Bun.serve({
      port: opts.port,
      async fetch(req) {
        const url = new URL(req.url);
        const p = url.pathname;
        if (p.startsWith("/api/") || p.startsWith("/auth/") || p.startsWith("/public/") || p === "/health" || p === "/setup") {
          return app.fetch(req);
        }
        if (p === "/config.json") return new Response(config, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
        const file = opts.assets[p];
        if (file) return new Response(Bun.file(file));
        // Hash router: every other path is the app shell.
        if (index) return new Response(Bun.file(index), { headers: { "content-type": "text/html; charset=utf-8" } });
        return new Response("not found", { status: 404 });
      },
    });

    return {
      url: `http://localhost:${server.port}`,
      stop: async () => {
        await server.stop(true);
        await pg.close();
      },
    };
  } catch (e) {
    // Boot failed after PGlite opened (bad app boot, port taken): release the
    // database so a retry on the same folder isn't blocked by a stale lock.
    await pg.close().catch(() => undefined);
    throw e;
  }
};
