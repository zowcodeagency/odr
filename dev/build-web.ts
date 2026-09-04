/*
 * Static build for the three browser apps → Cloudflare Pages.
 *
 *   bun dev/build-web.ts captain-pwa
 *
 * The `--plugin` CLI flag cannot be used: Bun tries to bundle the Tailwind
 * plugin for the browser target and chokes on its Node imports. Importing it
 * here keeps the plugin in Bun and only the app in the browser bundle.
 */
import { rm, mkdir, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import tailwind from "bun-plugin-tailwind";

const app = process.argv[2];
if (!app) throw new Error("usage: bun dev/build-web.ts <app-dir>");

const root = `${import.meta.dir}/../apps/${app}`;
const outdir = `${root}/dist`;

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const result = await Bun.build({
  entrypoints: [`${root}/src/index.html`],
  outdir,
  minify: true,
  // Sourcemaps are 3.8 MB of upload per deploy and leak source; opt in locally.
  sourcemap: process.env["SOURCEMAP"] ? "linked" : "none",
  // Without this React resolves its development build (1 MB, StrictMode
  // double-invokes every effect → every fetch fired twice in production).
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  plugins: [tailwind],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

// public/ ships as-is: manifest, icon — the URLs the app hardcodes.
if (existsSync(`${root}/public`)) {
  await cp(`${root}/public`, outdir, { recursive: true });
}

// Hash routing means every path must serve index.html; Workers static assets
// does that via not_found_handling = "single-page-application" in each app's
// wrangler.toml, and run_worker_first carves out the API paths. No _redirects.

// The dev server serves this route; on Pages it is a static file baked from
// the build environment. Same shape either way.
if (app === "captain-pwa") {
  const config = JSON.stringify({ dinerOrigin: process.env["DINER_ORIGIN"] ?? "" });
  await Bun.write(`${outdir}/config.json`, config);
  // Inline it too, so main.tsx never has to await a round trip before first render.
  const html = `${outdir}/index.html`;
  await Bun.write(html, (await Bun.file(html).text()).replace("<head>", `<head><script>window.__ODR=${config}</script>`));
}

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
for (const o of result.outputs) {
  console.log(`  ${o.path.replace(outdir + "/", "").padEnd(28)} ${kb(o.size)}`);
}
console.log(`▸ ${app} → apps/${app}/dist`);
