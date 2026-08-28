import { buildApp } from "./app.ts";

const app = await buildApp();
const port = Number(process.env.API_PORT ?? 3000);

Bun.serve({
  port,
  development: { hmr: true, console: true },
  fetch: app.fetch,
});

console.log(`odr api listening on :${port}`);
