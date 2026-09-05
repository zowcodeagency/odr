import { homedir } from "node:os";
import { join } from "node:path";
import { assets, migrations } from "./assets.gen.ts";
import { startBox } from "./serve.ts";

// Data folder the owner can find: ~/Odr (Windows: C:\Users\<name>\Odr). ODR_DATA overrides.
const dataDir = process.env.ODR_DATA ?? join(homedir(), "Odr");
const port = Number(process.env.ODR_PORT ?? 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`ODR_PORT must be a number between 0 and 65535, got "${process.env.ODR_PORT}"`);
  process.exit(1);
}

let box: Awaited<ReturnType<typeof startBox>> | undefined;
try {
  box = await startBox({ dataDir, port, assets, migrations });
  console.log(`Odr Box · data in ${dataDir} · open ${box.url} on any phone on this wifi`);
  console.log(`First-time setup code: ${box.setupCode} (only needed once, on the setup screen)`);
  for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => void box!.stop().then(() => process.exit(0)));
} catch (e) {
  console.error(`Odr Box could not start: ${e instanceof Error ? e.message : String(e)}`);
  console.error(`Check that the folder ${dataDir} is writable and that port ${port} is free (set ODR_PORT to change it).`);
  process.exit(1);
}
