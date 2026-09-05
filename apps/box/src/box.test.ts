import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBox } from "./serve.ts";

test("box boots on an empty folder, sets up a restaurant, owner signs in", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "odr-box-"));
  let box = await startBox({ dataDir, port: 0, assets: {} });
  try {
    const cfg = await (await fetch(`${box.url}/config.json`)).json();
    expect(cfg).toEqual({ dinerOrigin: "", offline: true });

    expect(await (await fetch(`${box.url}/setup`)).json()).toEqual({ needed: true });

    const wrongCode = await fetch(`${box.url}/setup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Box Cafe", ownerEmail: "o@box.test", ownerPassword: "password1", ownerFullName: "Owner", setupCode: "000000" }),
    });
    expect(wrongCode.status).toBe(403);

    const created = await fetch(`${box.url}/setup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Box Cafe", ownerEmail: "o@box.test", ownerPassword: "password1", ownerFullName: "Owner", setupCode: box.setupCode! }),
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
    expect(box.setupCode).toMatch(/^\d{6}$/);

    // A restart after setup prints no code: the first-run route is closed for good.
    await box.stop();
    box = await startBox({ dataDir, port: 0, assets: {} });
    expect(box.setupCode).toBeNull();
    expect(await (await fetch(`${box.url}/setup`)).json()).toEqual({ needed: false });
  } finally {
    await box.stop();
    rmSync(dataDir, { recursive: true, force: true });
  }
}, 30_000);

test("a failed boot releases the database for the next attempt", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "odr-box-"));
  const first = await startBox({ dataDir, port: 0, assets: {} });
  try {
    const firstPort = Number(new URL(first.url).port);

    // Same data folder, port already taken by `first`: Bun.serve must throw.
    await expect(startBox({ dataDir, port: firstPort, assets: {} })).rejects.toBeDefined();

    await first.stop();

    // If the failed attempt above left the PGlite folder released, a third
    // start on the same folder succeeds.
    const third = await startBox({ dataDir, port: 0, assets: {} });
    await third.stop();
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
}, 30_000);

test("an empty secret file is never left empty", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "odr-box-"));
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, "secret"), "");
  const box = await startBox({ dataDir, port: 0, assets: {} });
  try {
    const secret = readFileSync(join(dataDir, "secret"), "utf8").trim();
    expect(secret.length).toBeGreaterThanOrEqual(32);
  } finally {
    await box.stop();
    rmSync(dataDir, { recursive: true, force: true });
  }
}, 30_000);
