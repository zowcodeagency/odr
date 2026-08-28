import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations need a direct connection — the transaction pooler can't run DDL safely.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "postgres://odr:odr@localhost:5432/odr_dev",
  },
  strict: true,
  verbose: true,
} satisfies Config;
