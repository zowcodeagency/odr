import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import { setDb } from "@odr/db";
import { openPglite } from "@odr/db/pglite";

/*
 * Everything the Box serves, on one port: the API, the staff app, runtime config.
 * `assets` maps a URL path ("/index.html", "/chunk-abc.js") to a file path the
 * compiled binary can Bun.file(); dev passes {} and proxies to the captain dev server.
 * `migrations` maps a drizzle-folder-relative path to its embedded file path — only
 * the compiled binary passes these (see main.ts); the repo folder is used otherwise.
 */
/** Every IPv4 address this machine has on the LAN, as the URLs a phone must open. Recomputed per call: wifi changes. */
export const phoneUrls = (port: number | string): string[] =>
  Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => `http://${a!.address}:${port}`);

export const startBox = async (opts: { dataDir: string; port: number; assets: Record<string, string>; migrations?: Record<string, string> }) => {
  mkdirSync(opts.dataDir, { recursive: true });

  // A per-install JWT secret, generated once. auth/tokens reads process.env at import,
  // so this must be set before the API module loads (hence the dynamic import below).
  const secretFile = join(opts.dataDir, "secret");
  let secret = existsSync(secretFile) ? readFileSync(secretFile, "utf8").trim() : "";
  if (!secret) {
    secret = crypto.randomUUID() + crypto.randomUUID();
    writeFileSync(secretFile, secret, { mode: 0o600 });
  }
  process.env.JWT_SECRET ||= secret;

  // Compiled binary: unpack the embedded migration files so drizzle's folder-based
  // migrator can read them (the repo's packages/db/drizzle folder doesn't exist inside one).
  // ponytail: files are overwritten, never removed — a downgrade leaves a newer version's
  // .sql behind; drizzle follows meta/_journal.json (also overwritten), so they are ignored.
  // Wipe the folder here if that ever changes.
  const migrations = opts.migrations ?? {};
  if (Object.keys(migrations).length) {
    const dir = join(opts.dataDir, "migrations");
    mkdirSync(join(dir, "meta"), { recursive: true });
    for (const [rel, src] of Object.entries(migrations)) await Bun.write(join(dir, rel), Bun.file(src));
    process.env.ODR_MIGRATIONS = dir;
  }

  // Six digits, guards the unauthenticated first-run /setup route until the owner
  // (reading it off the Box's own console) types it back in — see setup.ts.
  const setupCode = String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(6, "0");

  const pg = await openPglite(join(opts.dataDir, "db"));
  try {
    setDb(pg.db);

    const { buildApp } = await import("@odr/api/app");
    const app = await buildApp({ setupCode });

    const config = JSON.stringify({ dinerOrigin: "", offline: true });
    const index = opts.assets["/index.html"];

    const server = Bun.serve({
      port: opts.port,
      async fetch(req, srv) {
        const url = new URL(req.url);
        const p = url.pathname;
        if (p.startsWith("/api/") || p.startsWith("/auth/") || p.startsWith("/public/") || p === "/health" || p === "/setup") {
          return app.fetch(req);
        }
        if (p === "/config.json") return new Response(config, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
      // The topbar's "Phone link" QR: which address a phone on this wifi should open.
      if (p === "/box/phone-urls") return Response.json({ urls: phoneUrls(srv.port ?? opts.port) }, { headers: { "cache-control": "no-store" } });
        const file = opts.assets[p];
        if (file) {
          const headers = /^\/chunk-/.test(p) ? { "cache-control": "public, max-age=31536000, immutable" } : undefined;
          return new Response(Bun.file(file), { headers });
        }
        // Hash router: every other path is the app shell.
        if (index) return new Response(Bun.file(index), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
        return new Response("not found", { status: 404 });
      },
    });

    return {
      url: `http://localhost:${server.port}`,
      // null once the restaurant exists — the code is only for the first run.
      setupCode: ((await (await app.request("/setup")).json()) as { needed: boolean }).needed ? setupCode : null,
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
