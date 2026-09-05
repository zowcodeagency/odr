import { homedir } from "node:os";
import { join } from "node:path";
import { assets } from "./assets.gen.ts";
import { startBox } from "./serve.ts";

// Data folder the owner can find: ~/Odr (Windows: C:\Users\<name>\Odr). ODR_DATA overrides.
const dataDir = process.env.ODR_DATA ?? join(homedir(), "Odr");
const port = Number(process.env.ODR_PORT ?? 3000);

const box = await startBox({ dataDir, port, assets });
console.log(`Odr Box · data in ${dataDir} · open ${box.url} on any phone on this wifi`);
