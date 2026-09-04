import { test, expect } from "bun:test";
import {
  addMonths,
  extendSubscription,
  isExpired,
  outletCodeFor,
  parseCsvMenu,
  parseJsonMenu,
  subscriptionStatus,
} from "./domain.ts";
import { makeAdminService } from "./service.ts";
import type { AdminRepo, TenantRow } from "./ports.ts";
import type { MenuService } from "../menu/service.ts";

const TODAY = "2026-08-24";

// ------------------------------------------------------------- top-up math

test("expired subscription resumes from today", () => {
  expect(extendSubscription("2026-06-30", 3, TODAY)).toBe("2026-11-24");
});

test("active subscription stacks onto the existing end date", () => {
  expect(extendSubscription("2026-12-01", 2, TODAY)).toBe("2027-02-01");
});

test("null end date (never subscribed) starts from today", () => {
  expect(extendSubscription(null, 1, TODAY)).toBe("2026-09-24");
});

test("month add clamps to the target month's last day", () => {
  expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
});

// ------------------------------------------------------------ enforcement

test("active subscription passes, expired is expired, null is unenforced", () => {
  expect(isExpired("2026-09-01", TODAY)).toBe(false);
  expect(isExpired(TODAY, TODAY)).toBe(false); // last day is still valid
  expect(isExpired("2026-08-23", TODAY)).toBe(true);
  expect(isExpired(null, TODAY)).toBe(false);
});

test("status buckets: none / expired / expiring (<=7d) / active", () => {
  expect(subscriptionStatus(null, TODAY)).toEqual({ status: "none", daysRemaining: null });
  expect(subscriptionStatus("2026-08-20", TODAY)).toEqual({ status: "expired", daysRemaining: -4 });
  expect(subscriptionStatus("2026-08-31", TODAY)).toEqual({ status: "expiring", daysRemaining: 7 });
  expect(subscriptionStatus("2026-09-01", TODAY)).toEqual({ status: "active", daysRemaining: 8 });
});

// ----------------------------------------------------------- menu parsing

test("JSON import defaults taxClass to GST_5 and isVeg to true", () => {
  const parsed = parseJsonMenu([
    { name: "Dosa", items: [{ name: "Masala Dosa", price: 120 }, { name: "Ghee Roast", price: "150.50", taxClass: "GST_12", isVeg: false }] },
  ]);
  expect(parsed).toEqual([
    {
      name: "Dosa",
      items: [
        { name: "Masala Dosa", price: "120.00", taxClass: "GST_5", isVeg: true, description: undefined },
        { name: "Ghee Roast", price: "150.50", taxClass: "GST_12", isVeg: false, description: undefined },
      ],
    },
  ]);
});

test("CSV import groups rows by category and applies the same defaults", () => {
  const parsed = parseCsvMenu(
    "category,name,price,taxClass,isVeg,description\n" +
      "Dosa,Masala Dosa,120,,,Crispy\n" +
      "Dosa,Ghee Roast,150.50,GST_12,no,\n" +
      "Drinks,Filter Coffee,40,,yes,\n",
  );
  expect(parsed.map((c) => c.name)).toEqual(["Dosa", "Drinks"]);
  expect(parsed[0]!.items).toEqual([
    { name: "Masala Dosa", price: "120", taxClass: "GST_5", isVeg: true, description: "Crispy" },
    { name: "Ghee Roast", price: "150.50", taxClass: "GST_12", isVeg: false, description: undefined },
  ]);
  expect(parsed[1]!.items[0]!.name).toBe("Filter Coffee");
});

test("CSV honours quoted fields containing commas", () => {
  const parsed = parseCsvMenu('category,name,price,description\nSnacks,Bhaji,60,"hot, spicy"\n');
  expect(parsed[0]!.items[0]!.description).toBe("hot, spicy");
});

test("CSV rejects a missing required column and a bad price", () => {
  expect(() => parseCsvMenu("category,name\nDosa,Plain\n")).toThrow(/missing "price"/);
  expect(() => parseCsvMenu("category,name,price\nDosa,Plain,free\n")).toThrow(/invalid price/);
});

// ------------------------------------------------------- import → menu svc

const fakeRepo = (tenant: TenantRow): AdminRepo =>
  ({
    tenantById: async () => tenant,
  }) as unknown as AdminRepo;

test("import reuses an existing category by name and only counts new ones", async () => {
  const categories = [{ id: "cat-existing", name: "Dosa" }];
  const items: { categoryId: string; name: string; taxClass: string }[] = [];
  const menu = {
    listCategories: async () => categories,
    createCategory: async ({ name }: { name: string }) => {
      const c = { id: `cat-${categories.length + 1}`, name };
      categories.push(c);
      return c;
    },
    upsertItem: async (i: { categoryId: string; name: string; taxClass: string }) => {
      const at = items.findIndex(
        (x) => x.categoryId === i.categoryId && x.name.toLowerCase() === i.name.toLowerCase(),
      );
      if (at >= 0) {
        items[at] = i;
        return { item: i, created: false };
      }
      items.push(i);
      return { item: i, created: true };
    },
  } as unknown as MenuService;

  const svc = makeAdminService({
    repo: fakeRepo({
      id: "t-1",
      name: "X",
      slug: "x",
      localBilling: false,
      subscriptionStart: null,
      subscriptionEnd: null,
      createdAt: "",
      outletCount: 1,
    }),
    menu,
  });

  const result = await svc.importMenu("11111111-1111-1111-1111-111111111111", [
    { name: "Dosa", items: [{ name: "Masala Dosa", price: "120.00", taxClass: "GST_5", isVeg: true }] },
    { name: "Drinks", items: [{ name: "Coffee", price: "40.00", taxClass: "GST_5", isVeg: true }] },
  ]);

  expect(result).toEqual({ categoriesCreated: 1, itemsCreated: 2, itemsUpdated: 0 });
  expect(items[0]!.categoryId).toBe("cat-existing");

  // Re-importing the same menu with a corrected price must UPDATE, never
  // leave the restaurant with the dish listed twice at two prices.
  const again = await svc.importMenu("11111111-1111-1111-1111-111111111111", [
    { name: "Dosa", items: [{ name: "Masala Dosa", price: "135.00", taxClass: "GST_5", isVeg: true }] },
  ]);
  expect(again).toEqual({ categoriesCreated: 0, itemsCreated: 0, itemsUpdated: 1 });
  expect(items).toHaveLength(2);
});

// --------------------------------------------------------------- outlets

test("outlet code is an upper-case slug capped at 16 chars", () => {
  expect(outletCodeFor("Spice Route – Airport Road")).toBe("SPICE-ROUTE-AIRP");
  expect(outletCodeFor("  ")).toBe("OUTLET");
});

test("adding an outlet picks a free code and honours the menu choice", async () => {
  const created: unknown[] = [];
  const repo = {
    tenantById: async () => ({ id: "t-1", name: "X", slug: "x", subscriptionStart: null, subscriptionEnd: null, createdAt: "", outletCount: 1 }),
    outletCodeExists: async (_t: string, code: string) => code === "AIRPORT",
    createOutlet: async (input: unknown) => {
      created.push(input);
      return { id: "o-2" };
    },
  } as unknown as AdminRepo;
  const svc = makeAdminService({ repo, menu: {} as MenuService });
  const res = await svc.createOutlet("t-1", {
    name: "Airport",
    address: { line1: "Terminal 1", city: "Mangalore", state: "Karnataka", pincode: "574142", country: "IN" },
    menuMode: "own",
  });
  expect(res).toEqual({ outletId: "o-2", code: "AIRPORT-2" });
  expect(created[0]).toMatchObject({ tenantId: "t-1", code: "AIRPORT-2", menuMode: "own", invoicePrefix: "A" });
});

test("outlet code retries stay within 16 chars past double-digit suffixes", async () => {
  const repo = {
    tenantById: async () => ({ id: "t-1", name: "X", slug: "x", subscriptionStart: null, subscriptionEnd: null, createdAt: "", outletCount: 1 }),
    // base and "-2".."-10" are taken; "-11" is free.
    outletCodeExists: async (_t: string, code: string) => code === "SPICE-ROUTE-AIRP" || /-(?:[2-9]|10)$/.test(code),
    createOutlet: async () => ({ id: "o-2" }),
  } as unknown as AdminRepo;
  const svc = makeAdminService({ repo, menu: {} as MenuService });
  const res = await svc.createOutlet("t-1", {
    name: "SPICE ROUTE AIRPORT ROAD",
    address: { line1: "Terminal 1", city: "Mangalore", state: "Karnataka", pincode: "574142", country: "IN" },
    menuMode: "own",
  });
  expect(res.code.length).toBeLessThanOrEqual(16);
  expect(res.code.endsWith("-11")).toBe(true);
});
