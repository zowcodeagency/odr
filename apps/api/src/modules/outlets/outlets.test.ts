import { test, expect } from "bun:test";
import { InMemoryEventBus } from "@odr/events";
import { runWithContext } from "@odr/tenancy";
import { asTenantId, asUserId } from "@odr/shared";
import { makeOutletsService } from "./service.ts";
import type { OutletsRepo } from "./ports.ts";

const ctx = {
  tenantId: asTenantId("11111111-1111-1111-1111-111111111111"),
  userId: asUserId("22222222-2222-2222-2222-222222222222"),
  role: "owner" as const,
};
const OUTLET = "33333333-3333-3333-3333-333333333333";

// Mirrors the repo's `coalesce(public_token, $candidate)` get-or-create.
const fakeRepo = (): OutletsRepo => {
  let token: string | null = null;
  return {
    list: async () => [],
    byId: async () => null,
    create: async () => { throw new Error("unused"); },
    updateSettings: async () => null,
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
