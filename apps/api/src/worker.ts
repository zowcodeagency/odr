import { withRequestDb } from "@odr/db";
import { buildApp } from "./app.ts";

const app = await buildApp();

type Env = Record<string, string> & { HYPERDRIVE?: { connectionString: string } };
type Ctx = { waitUntil: (p: Promise<unknown>) => void };

export default {
  fetch: (req: Request, env: Env, ctx: Ctx) =>
    withRequestDb(
      env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL!,
      async () => app.fetch(req, env, ctx as never),
      (p) => ctx.waitUntil(p),
    ),
};
