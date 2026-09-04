import { test, expect } from "bun:test";
import { InMemoryEventBus } from "@odr/events";
import { runWithContext } from "@odr/tenancy";
import { asTenantId, asUserId } from "@odr/shared";
import { makeOutletsService } from "./service.ts";
import type { OutletsRepo } from "./ports.ts";
import type { Outlet } from "./domain.ts";

const ctx = {
  tenantId: asTenantId("11111111-1111-1111-1111-111111111111"),
  userId: asUserId("22222222-2222-2222-2222-222222222222"),
  role: "owner" as const,
};
const OUTLET = "33333333-3333-3333-3333-333333333333";
const OTHER = "44444444-4444-4444-4444-444444444444";

const outlet = (id: string, over: Partial<Outlet> = {}): Outlet => ({
  id,
  name: id === OUTLET ? "Central" : "Airport",
  code: id.slice(0, 4),
  gstin: null,
  upiId: null,
  address: { line1: "-", city: "-", state: "-", pincode: "-", country: "IN" },
  invoicePrefix: "INV",
  paperWidth: 80,
  printerIp: null,
  printerPort: 9100,
  publicToken: null,
  isActive: true,
  menuMode: "shared",
  ...over,
});

// Mirrors the repo's `coalesce(public_token, $candidate)` get-or-create.
const fakeRepo = (rows: Outlet[] = [outlet(OUTLET), outlet(OTHER)]): OutletsRepo => {
  let token: string | null = null;
  return {
    list: async () => rows,
    byId: async (_t, id) => rows.find((o) => o.id === id) ?? null,
    updateSettings: async (_t, id, s) => {
      const o = rows.find((x) => x.id === id);
      return o ? Object.assign(o, s) : null;
    },
    async ensurePublicToken(_t, _o, candidate) { token ??= candidate; return token; },
    listTables: async () => [],
    addTables: async () => [],
    deleteTable: async () => true,
  };
};

test("qr-token is get-or-create: printed QR codes keep working", async () => {
  const svc = makeOutletsService({ repo: fakeRepo(), events: new InMemoryEventBus() });
  await runWithContext(ctx, async () => {
    const first = await svc.ensurePublicToken(OUTLET);
    expect(first).toHaveLength(32);
    expect(await svc.ensurePublicToken(OUTLET)).toBe(first);
  });
});

test("paperWidth only accepts 58 or 80", async () => {
  const svc = makeOutletsService({ repo: fakeRepo(), events: new InMemoryEventBus() });
  await runWithContext(ctx, async () => {
    await expect(svc.updateSettings(OUTLET, { paperWidth: 72 })).rejects.toThrow(/58 or 80/);
  });
});

test("owners see every outlet, active first; pinned staff see only theirs", async () => {
  const rows = [outlet(OUTLET, { isActive: false }), outlet(OTHER)];
  const svc = makeOutletsService({ repo: fakeRepo(rows), events: new InMemoryEventBus() });
  await runWithContext(ctx, async () => {
    expect((await svc.list()).map((o) => o.id)).toEqual([OTHER, OUTLET]);
  });
  await runWithContext({ ...ctx, role: "captain", outletId: OUTLET }, async () => {
    expect((await svc.list()).map((o) => o.id)).toEqual([OUTLET]);
    await expect(svc.listTables(OTHER)).rejects.toThrow(/out of scope/);
  });
});

test("owner can rename an outlet and fix its GSTIN; a bad GSTIN is rejected", async () => {
  const svc = makeOutletsService({ repo: fakeRepo(), events: new InMemoryEventBus() });
  await runWithContext(ctx, async () => {
    const o = await svc.updateSettings(OUTLET, { name: "Central Kitchen", gstin: "29ABCDE1234F1Z5" });
    expect(o.name).toBe("Central Kitchen");
    await expect(svc.updateSettings(OUTLET, { gstin: "nope" })).rejects.toThrow(/GSTIN/);
  });
});

test("activeInTenant answers without a request context", async () => {
  const svc = makeOutletsService({ repo: fakeRepo([outlet(OUTLET, { isActive: false })]), events: new InMemoryEventBus() });
  expect(await svc.activeInTenant(ctx.tenantId, OUTLET)).toBe(false);
  expect(await svc.activeInTenant(ctx.tenantId, OTHER)).toBe(false);
});
