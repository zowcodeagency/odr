import { withRequestDb } from "@odr/db";
import { buildApp } from "./app.ts";

const app = await buildApp();

type Env = Record<string, string> & { HYPERDRIVE?: { connectionString: string } };

export default {
  fetch: (req: Request, env: Env, ctx: unknown) =>
    withRequestDb(env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL!, async () =>
      app.fetch(req, env, ctx as never),
    ),
};
