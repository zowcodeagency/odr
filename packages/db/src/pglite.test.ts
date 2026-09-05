import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { rowsOf } from "./index.ts";
import { openPglite } from "./pglite.ts";
import { tenants } from "./schema/index.ts";

test("openPglite migrates an empty folder and persists across reopen", async () => {
  const dir = mkdtempSync(join(tmpdir(), "odr-pglite-"));
  try {
    const first = await openPglite(dir);
    await first.db.insert(tenants).values({ slug: "t1", name: "T1", country: "IN", currency: "INR" });
    // Raw SQL comes back as { rows } under PGlite (an array under postgres.js); rowsOf hides that.
    expect(rowsOf(await first.db.execute(sql`select 1 as x`))).toEqual([{ x: 1 }]);
    await first.close();

    // Second open: migrations are a no-op, data is still there.
    const second = await openPglite(dir);
    const rows = await second.db.select().from(tenants);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.slug).toBe("t1");
    await second.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("openPglite closes the client when migration fails, releasing the folder for a retry", async () => {
  const dir = mkdtempSync(join(tmpdir(), "odr-pglite-fail-"));
  const migDir = mkdtempSync(join(tmpdir(), "odr-pglite-mig-"));
  const prevMigrations = process.env.ODR_MIGRATIONS;
  try {
    mkdirSync(join(migDir, "meta"), { recursive: true });
    const journal = readFileSync(join(import.meta.dir, "../drizzle/meta/_journal.json"), "utf8");
    writeFileSync(join(migDir, "meta/_journal.json"), journal);
    const firstTag = (JSON.parse(journal) as { entries: { tag: string }[] }).entries[0]!.tag;
    writeFileSync(join(migDir, `${firstTag}.sql`), "THIS IS NOT SQL;");

    process.env.ODR_MIGRATIONS = migDir;
    await expect(openPglite(dir)).rejects.toBeDefined();

    // Same folder, migrations fixed by pointing back at the real ones: if the
    // failed attempt above left PGlite's lock held, this second open hangs/rejects.
    delete process.env.ODR_MIGRATIONS;
    const second = await openPglite(dir);
    await second.close();
  } finally {
    if (prevMigrations === undefined) delete process.env.ODR_MIGRATIONS;
    else process.env.ODR_MIGRATIONS = prevMigrations;
    rmSync(dir, { recursive: true, force: true });
    rmSync(migDir, { recursive: true, force: true });
  }
});
