/*
 * The Box's database: Postgres in-process (PGlite), data in a folder. Only the Box
 * imports this file — the cloud Worker must never pull WASM into its bundle.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { join } from "node:path";
// Relative paths, not bare specifiers: @electric-sql/pglite's package.json "exports"
// map has no "./dist/*" wildcard, so a bare "@electric-sql/pglite/dist/*.wasm" import
// is blocked by Node/Bun's exports resolution even though the files exist on disk.
import pgliteWasm from "../node_modules/@electric-sql/pglite/dist/pglite.wasm" with { type: "file" };
import initdbWasm from "../node_modules/@electric-sql/pglite/dist/initdb.wasm" with { type: "file" };
import pgliteData from "../node_modules/@electric-sql/pglite/dist/pglite.data" with { type: "file" };
import * as schema from "./schema/index.ts";
import type { DB } from "./index.ts";

/** Task 7's build unpacks embedded migrations and points ODR_MIGRATIONS at them before opening. */
const migrationsFolder = () => process.env.ODR_MIGRATIONS ?? join(import.meta.dir, "../drizzle");

export const openPglite = async (folder: string): Promise<{ db: DB; close: () => Promise<void> }> => {
  const client = new PGlite(folder, {
    pgliteWasmModule: await WebAssembly.compile(await Bun.file(pgliteWasm).arrayBuffer()),
    initdbWasmModule: await WebAssembly.compile(await Bun.file(initdbWasm).arrayBuffer()),
    fsBundle: new Blob([await Bun.file(pgliteData).arrayBuffer()]),
  });
  const db = drizzle({ client, schema }) as unknown as DB;
  await migrate(db as never, { migrationsFolder: migrationsFolder() });
  return { db, close: () => client.close() };
};
