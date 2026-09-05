import { test, expect } from "bun:test";
import { buildSetupRoutes } from "./setup.ts";

const fakeRepo = (tenantCount: () => number) => ({ listTenants: async () => Array(tenantCount()).fill({}) }) as never;

test("setup is open with no tenant, closed once one exists", async () => {
  let count = 0;
  const svc = {
    createRestaurant: async () => {
      count++;
      return { tenantId: "t", outletId: "o", userId: "u", slug: "s", subscriptionStart: "2026-09-05", subscriptionEnd: "2027-09-05" };
    },
  } as never;
  const app = buildSetupRoutes(svc, fakeRepo(() => count));

  expect(await (await app.request("/setup")).json()).toEqual({ needed: true });

  const body = { name: "Zow Cafe", ownerEmail: "a@b.co", ownerPassword: "longenough", ownerFullName: "Admin", gstin: "29ABCDE1234F1Z5" };
  const created = await app.request("/setup", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  expect(created.status).toBe(201);
  expect(await created.json()).toEqual({ tenantId: "t", outletId: "o" });

  expect(await (await app.request("/setup")).json()).toEqual({ needed: false });
  const again = await app.request("/setup", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  expect(again.status).toBe(409);
});
