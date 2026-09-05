import { homedir, networkInterfaces } from "node:os";
import { join } from "node:path";
import { assets, migrations } from "./assets.gen.ts";
import { startBox } from "./serve.ts";

// Data folder the owner can find: ~/Odr (Windows: C:\Users\<name>\Odr). ODR_DATA overrides.
const dataDir = process.env.ODR_DATA ?? join(homedir(), "Odr");
// 7777: out of the way of dev servers (3000, 5173, 8080) and printers (9100).
const port = Number(process.env.ODR_PORT ?? 7777);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`ODR_PORT must be a number between 0 and 65535, got "${process.env.ODR_PORT}"`);
  process.exit(1);
}

let box: Awaited<ReturnType<typeof startBox>> | undefined;
try {
  box = await startBox({ dataDir, port, assets, migrations });
  // Every IPv4 address this machine has on the LAN — the one a phone must type.
  const lan = Object.values(networkInterfaces()).flat().filter((a) => a && a.family === "IPv4" && !a.internal).map((a) => a!.address);
  const actualPort = new URL(box.url).port;
  console.log(`Odr Box · data in ${dataDir}`);
  console.log(`On this computer: ${box.url}`);
  console.log(lan.length ? `On a phone on this wifi: ${lan.map((ip) => `http://${ip}:${actualPort}`).join("  or  ")}` : "No wifi/ethernet address found — connect this computer to the restaurant wifi.");
  console.log(`First-time setup code: ${box.setupCode} (only needed once, on the setup screen)`);
  for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => void box!.stop().then(() => process.exit(0)));
} catch (e) {
  console.error(`Odr Box could not start: ${e instanceof Error ? e.message : String(e)}`);
  console.error(`Check that the folder ${dataDir} is writable and that port ${port} is free (set ODR_PORT to change it).`);
  process.exit(1);
}
