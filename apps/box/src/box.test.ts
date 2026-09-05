import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBox } from "./serve.ts";

test("box boots on an empty folder, sets up a restaurant, owner signs in", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "odr-box-"));
  const box = await startBox({ dataDir, port: 0, assets: {} });
  try {
    const cfg = await (await fetch(`${box.url}/config.json`)).json();
    expect(cfg).toEqual({ dinerOrigin: "", offline: true });

    expect(await (await fetch(`${box.url}/setup`)).json()).toEqual({ needed: true });

    const created = await fetch(`${box.url}/setup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Box Cafe", ownerEmail: "o@box.test", ownerPassword: "password1", ownerFullName: "Owner" }),
    });
    expect(created.status).toBe(201);

    const login = await fetch(`${box.url}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "o@box.test", password: "password1" }),
    });
    expect(login.status).toBe(200);
    const { token } = (await login.json()) as { token: string };

    const outlets = await fetch(`${box.url}/api/v1/outlets`, { headers: { authorization: `Bearer ${token}` } });
    expect(((await outlets.json()) as { outlets: unknown[] }).outlets).toHaveLength(1);
  } finally {
    await box.stop();
    rmSync(dataDir, { recursive: true, force: true });
  }
}, 30_000);
