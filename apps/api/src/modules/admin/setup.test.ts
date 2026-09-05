import { test, expect } from "bun:test";
import { buildSetupRoutes } from "./setup.ts";

const fakeRepo = (tenantCount: () => number) => ({ listTenants: async () => Array(tenantCount()).fill({}) }) as never;
const fakeSvc = () =>
  ({
    createRestaurant: async () => ({ tenantId: "t", outletId: "o", userId: "u", slug: "s", subscriptionStart: "2026-09-05", subscriptionEnd: "2027-09-05" }),
  }) as never;
const body = (setupCode: string) => ({ name: "Zow Cafe", ownerEmail: "a@b.co", ownerPassword: "longenough", ownerFullName: "Admin", gstin: "29ABCDE1234F1Z5", setupCode });
const post = (app: ReturnType<typeof buildSetupRoutes>, setupCode: string) =>
  app.request("/setup", { method: "POST", body: JSON.stringify(body(setupCode)), headers: { "content-type": "application/json" } });

test("setup is open with no tenant, closed once one exists", async () => {
  let count = 0;
  const app = buildSetupRoutes(fakeSvc(), fakeRepo(() => count), "123456");

  expect(await (await app.request("/setup")).json()).toEqual({ needed: true });

  const wrong = await post(app, "000000");
  expect(wrong.status).toBe(403);

  const created = await post(app, "123456");
  count++;
  expect(created.status).toBe(201);
  expect(await created.json()).toEqual({ tenantId: "t", outletId: "o" });

  expect(await (await app.request("/setup")).json()).toEqual({ needed: false });
  const again = await post(app, "123456");
  expect(again.status).toBe(409);
});

test("five wrong setup codes lock the route — even the right code then 403s", async () => {
  // Repo reports zero tenants throughout: keeps /setup open so the lockout
  // check (not the 409 "already set up" check) is what the test exercises.
  const app = buildSetupRoutes(fakeSvc(), fakeRepo(() => 0), "123456");

  for (let i = 0; i < 5; i++) {
    const res = await post(app, "000000");
    expect(res.status).toBe(403);
  }

  const lockedOut = await post(app, "123456");
  expect(lockedOut.status).toBe(403);
});
