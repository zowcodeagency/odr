import { test, expect } from "bun:test";
import { InMemoryEventBus } from "@odr/events";
import { inMemoryOrderRepo } from "../ordering/repo.memory.ts";
import { makeOrderingService } from "../ordering/service.ts";
import type { MenuService } from "../menu/service.ts";
import { makePublicService } from "./service.ts";
import type { PublicRepo, PublicOutlet } from "./ports.ts";

const OUTLET = "33333333-3333-3333-3333-333333333333";
const ITEM = "44444444-4444-4444-4444-444444444444";

const outlet: PublicOutlet = {
  id: OUTLET,
  tenantId: "11111111-1111-1111-1111-111111111111",
  name: "Coastal Spice",
  publicToken: "goodtoken",
};

const repo: PublicRepo = {
  async outletById(id) { return id === OUTLET ? outlet : null; },
  async outletForOrder() { return outlet; },
};

// Only the two reads the public service uses.
const menu = {
  listCategories: async () => [{ id: "c1", outletId: null, name: "Dosa", sortOrder: 0, isActive: true }],
  listItems: async () => [{
    id: ITEM, outletId: null, categoryId: "c1", name: "Masala Dosa", description: null,
    basePrice: "120.00", taxClass: "GST_5", isVeg: true, isActive: true, sortOrder: 0,
  }],
} as unknown as MenuService;

const build = () =>
  makePublicService({
    repo,
    menu,
    ordering: makeOrderingService({ repo: inMemoryOrderRepo(), events: new InMemoryEventBus() }),
  });

test("public order prices from the menu, ignoring whatever the client sent", async () => {
  const svc = build();
  const { orderId, code } = await svc.placeOrder(OUTLET, {
    token: "goodtoken",
    tableLabel: "T-4",
    lines: [{ itemId: ITEM, qty: 2, note: "extra chutney", unitPriceMinor: 1n, itemName: "Free Dosa" } as never],
  });

  expect(code).toHaveLength(6);
  const status = await svc.orderStatus(orderId, "goodtoken");
  expect(status.totalMinor).toBe("24000"); // 2 × ₹120.00, not the client's 1 paisa
  expect(status.lines).toEqual([{ itemName: "Masala Dosa", qty: 2 }]);
  expect(status.status).toBe("items_added");
});

test("wrong token is a 404, never a menu leak", async () => {
  const svc = build();
  await expect(svc.menu(OUTLET, "badtoken")).rejects.toThrow(/not found/);
  await expect(
    svc.placeOrder(OUTLET, { token: "badtoken", tableLabel: "T-4", lines: [{ itemId: ITEM, qty: 1 }] }),
  ).rejects.toThrow(/not found/);
});

test("a sold-out dish is refused, not silently dropped from the diner's order", async () => {
  const soldOut = {
    listCategories: async () => [{ id: "c1", outletId: null, name: "Dosa", sortOrder: 0, isActive: true }],
    listItems: async () => [{
      id: ITEM, outletId: null, categoryId: "c1", name: "Masala Dosa", description: null,
      basePrice: "120.00", taxClass: "GST_5", isVeg: true, isActive: false, sortOrder: 0,
    }],
  } as unknown as MenuService;

  const svc = makePublicService({
    repo,
    menu: soldOut,
    ordering: makeOrderingService({ repo: inMemoryOrderRepo(), events: new InMemoryEventBus() }),
  });

  // Hidden from the menu the diner is shown…
  expect((await svc.menu(OUTLET, "goodtoken")).categories).toHaveLength(0);

  // …and refused if an older tab still has it in the cart.
  await expect(
    svc.placeOrder(OUTLET, { token: "goodtoken", tableLabel: "T-1", lines: [{ itemId: ITEM, qty: 1 }] }),
  ).rejects.toThrow(/no longer available/);
});
