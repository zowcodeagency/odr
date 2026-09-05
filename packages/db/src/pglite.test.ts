import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openPglite } from "./pglite.ts";
import { tenants } from "./schema/index.ts";

test("openPglite migrates an empty folder and persists across reopen", async () => {
  const dir = mkdtempSync(join(tmpdir(), "odr-pglite-"));
  try {
    const first = await openPglite(dir);
    await first.db.insert(tenants).values({ slug: "t1", name: "T1", country: "IN", currency: "INR" });
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
