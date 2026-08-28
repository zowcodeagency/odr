import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DIRECT_URL or DATABASE_URL must be set");

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, "../drizzle");

const sql = new SQL(url);
const migrator = drizzle({ client: sql });
await migrate(migrator, { migrationsFolder });
console.log("migrations applied");
process.exit(0);
