import { test, expect } from "bun:test";
import { InMemoryEventBus } from "@odr/events";
import { runWithContext } from "@odr/tenancy";
import { asTenantId, asUserId } from "@odr/shared";
import { makeMenuService } from "./service.ts";
import type { ItemRow, MenuRepo } from "./ports.ts";
import type { Category } from "./domain.ts";

const TENANT = "11111111-1111-1111-1111-111111111111";
const OUTLET_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OUTLET_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const MODES: Record<string, "shared" | "own"> = { [OUTLET_A]: "shared", [OUTLET_B]: "own" };

const makeFakeRepo = (): MenuRepo & { _categories: Category[]; _items: ItemRow[]; _soldout: Set<string> } => {
  const _categories: Category[] = [];
  const _items: ItemRow[] = [];
  const _soldout = new Set<string>(); // `${outletId}:${itemId}`
  const _images = new Map<string, { data: string; type: string }>();
  let i = 0;
  const newId = () => `cat-${++i}`;
  const visible = (rowOutlet: string | null, outletId?: string, mode?: "shared" | "own") =>
    outletId === undefined ? true : mode === "own" ? rowOutlet === outletId : rowOutlet === null || rowOutlet === outletId;
  return {
    _categories,
    _items,
    _soldout,
    async outletMenuMode(_t, id) {
      return MODES[id] ?? null;
    },
    async soldOutItemIds(_t, outletId) {
      return new Set([..._soldout].filter((k) => k.startsWith(`${outletId}:`)).map((k) => k.split(":")[1]!));
    },
    async setSoldOut(_t, outletId, itemId, soldOut) {
      const k = `${outletId}:${itemId}`;
      if (soldOut) _soldout.add(k);
      else _soldout.delete(k);
    },
    async listCategories(_t, outletId, mode) {
      return _categories.filter((c) => visible(c.outletId, outletId, mode));
    },
    async createCategory(_t, input) {
      const c: Category = { id: newId(), outletId: input.outletId ?? null, name: input.name, sortOrder: input.sortOrder ?? 0, isActive: true };
      _categories.push(c);
      return c;
    },
    async updateCategory(_t, id, patch) {
      const c = _categories.find((x) => x.id === id)!;
      Object.assign(c, patch);
      return c;
    },
    async deleteCategory(_t, id) {
      _categories.splice(_categories.findIndex((x) => x.id === id), 1);
    },
    async updateItem(_t, id, { image, ...patch }) {
      const it = _items.find((x) => x.id === id)!;
      Object.assign(it, patch);
      if (image !== undefined) {
        if (image === null) _images.delete(id);
        else _images.set(id, image);
        it.hasImage = image !== null;
      }
      return it;
    },
    async itemImage(id) {
      return _images.get(id) ?? null;
    },
    async deleteItem(_t, id) {
      _items.splice(_items.findIndex((x) => x.id === id), 1);
    },
    async listItems(_t, { categoryId, outletId, mode }) {
      return _items.filter((it) => (!categoryId || it.categoryId === categoryId) && visible(it.outletId, outletId, mode));
    },
    async createItem(_t, input) {
      const it: ItemRow = {
        id: `item-${_items.length + 1}`,
        outletId: input.outletId ?? null,
        categoryId: input.categoryId,
        name: input.name,
        description: input.description ?? null,
        basePrice: input.basePrice,
        taxClass: input.taxClass,
        isVeg: input.isVeg,
        isActive: true,
        sortOrder: 0,
        hasImage: input.image != null,
      };
      if (input.image != null) _images.set(it.id, input.image);
      _items.push(it);
      return it;
    },
  };
};

const ctx = { tenantId: asTenantId(TENANT), userId: asUserId("u-1"), role: "owner" as const };

test("listCategories(outletA) returns master ∪ outletA overrides, never outletB", async () => {
  const repo = makeFakeRepo();
  const svc = makeMenuService({ repo, events: new InMemoryEventBus(), country: () => "IN" });

  await runWithContext(ctx, async () => {
    await svc.createCategory({ name: "Master Beverages" });                  // master
    await svc.createCategory({ name: "Outlet A Specials", outletId: OUTLET_A });
    await svc.createCategory({ name: "Outlet B Specials", outletId: OUTLET_B });

    const visible = await svc.listCategories(OUTLET_A);
    expect(visible.map((c) => c.name).sort()).toEqual(["Master Beverages", "Outlet A Specials"]);
  });
});

test("createCategory rejects an outletId from another tenant", async () => {
  const repo = makeFakeRepo();
  const svc = makeMenuService({ repo, events: new InMemoryEventBus(), country: () => "IN" });

  await runWithContext(ctx, async () => {
    await expect(
      svc.createCategory({ name: "Sneaky", outletId: "deadbeef-dead-beef-dead-beefdeadbeef" }),
    ).rejects.toThrow(/outlet .* not found/);
  });
});

test("admin view (no outletId) returns every category", async () => {
  const repo = makeFakeRepo();
  const svc = makeMenuService({ repo, events: new InMemoryEventBus(), country: () => "IN" });

  await runWithContext(ctx, async () => {
    await svc.createCategory({ name: "Master" });
    await svc.createCategory({ name: "A", outletId: OUTLET_A });
    await svc.createCategory({ name: "B", outletId: OUTLET_B });
    expect(await svc.listCategories()).toHaveLength(3);
  });
});

test("upsertItem matches on (category, name) — a re-import updates, never duplicates", async () => {
  const repo = makeFakeRepo();
  const svc = makeMenuService({ repo, events: new InMemoryEventBus(), country: () => "IN" });

  await runWithContext(ctx, async () => {
    const cat = await svc.createCategory({ name: "Dosa" });
    const first = await svc.upsertItem({
      categoryId: cat.id, name: "Masala Dosa", basePrice: "120.00", taxClass: "GST_5", isVeg: true,
    });
    expect(first.created).toBe(true);

    // Same dish, corrected price, different casing and stray spaces.
    const second = await svc.upsertItem({
      categoryId: cat.id, name: "  masala dosa ", basePrice: "135.00", taxClass: "GST_5", isVeg: true,
    });
    expect(second.created).toBe(false);
    expect(repo._items).toHaveLength(1);
    expect(repo._items[0]!.basePrice).toBe("135.00");
  });
});

test("sold out is a flag, delete removes the row", async () => {
  const repo = makeFakeRepo();
  const svc = makeMenuService({ repo, events: new InMemoryEventBus(), country: () => "IN" });

  await runWithContext(ctx, async () => {
    const cat = await svc.createCategory({ name: "Dosa" });
    const item = await svc.createItem({
      categoryId: cat.id, name: "Ghee Roast", basePrice: "150.50", taxClass: "GST_12", isVeg: false,
    });

    const off = await svc.updateItem(item.id, { isActive: false });
    expect(off.isActive).toBe(false);
    expect(repo._items).toHaveLength(1);

    await svc.deleteItem(item.id);
    expect(repo._items).toHaveLength(0);
  });
});

test("a category with dishes in it cannot be deleted", async () => {
  const repo = makeFakeRepo();
  const svc = makeMenuService({ repo, events: new InMemoryEventBus(), country: () => "IN" });

  await runWithContext(ctx, async () => {
    const cat = await svc.createCategory({ name: "Dosa" });
    await svc.createItem({
      categoryId: cat.id, name: "Plain Dosa", basePrice: "90.00", taxClass: "GST_5", isVeg: true,
    });
    await expect(svc.deleteCategory(cat.id)).rejects.toThrow(/dishes first/);

    await svc.deleteItem(repo._items[0]!.id);
    await svc.deleteCategory(cat.id);
    expect(repo._categories).toHaveLength(0);
  });
});

test("a captain cannot edit the menu", async () => {
  const repo = makeFakeRepo();
  const svc = makeMenuService({ repo, events: new InMemoryEventBus(), country: () => "IN" });

  await runWithContext(ctx, async () => {
    const cat = await svc.createCategory({ name: "Dosa" });
    await svc.createItem({
      categoryId: cat.id, name: "Plain Dosa", basePrice: "90.00", taxClass: "GST_5", isVeg: true,
    });
  });

  await runWithContext({ ...ctx, role: "captain" as const }, async () => {
    await expect(svc.updateItem(repo._items[0]!.id, { isActive: false })).rejects.toThrow(/cannot write menu/);
  });
});

test("dish photo: create stores it, patch null removes it, list stays slim", async () => {
  const repo = makeFakeRepo();
  const svc = makeMenuService({ repo, events: new InMemoryEventBus(), country: () => "IN" });

  await runWithContext(ctx, async () => {
    const cat = await svc.createCategory({ name: "Dosa" });
    const item = await svc.createItem({
      categoryId: cat.id, name: "Masala Dosa", basePrice: "120.00", taxClass: "GST_5", isVeg: true,
      image: { data: "aGVsbG8=", type: "image/jpeg" },
    });
    expect(item.hasImage).toBe(true);
    await expect(svc.itemImage(item.id)).resolves.toEqual({ data: "aGVsbG8=", type: "image/jpeg" });

    // The list projection carries only the flag, never the bytes.
    const listed = (await svc.listItems({ categoryId: cat.id }))[0]!;
    expect(listed.hasImage).toBe(true);
    expect("image" in listed).toBe(false);

    const cleared = await svc.updateItem(item.id, { image: null });
    expect(cleared.hasImage).toBe(false);
    await expect(svc.itemImage(item.id)).resolves.toBeNull();
  });
});

test("shared-mode outlets write master rows; own-mode outlets write their own", async () => {
  const repo = makeFakeRepo();
  const svc = makeMenuService({ repo, events: new InMemoryEventBus(), country: () => "IN" });
  await runWithContext(ctx, async () => {
    const shared = await svc.createCategory({ outletId: OUTLET_A, name: "Dosa" });
    const own = await svc.createCategory({ outletId: OUTLET_B, name: "Airport specials" });
    expect(shared.outletId).toBeNull();
    expect(own.outletId).toBe(OUTLET_B);

    // A reads master rows only; B reads its own rows only.
    expect((await svc.listCategories(OUTLET_A)).map((c) => c.name)).toEqual(["Dosa"]);
    expect((await svc.listCategories(OUTLET_B)).map((c) => c.name)).toEqual(["Airport specials"]);
  });
});

test("sold out is per outlet and folds into isActive for that outlet only", async () => {
  const repo = makeFakeRepo();
  const svc = makeMenuService({ repo, events: new InMemoryEventBus(), country: () => "IN" });
  await runWithContext(ctx, async () => {
    const cat = await svc.createCategory({ name: "Dosa" });
    const item = await svc.createItem({ categoryId: cat.id, name: "Masala Dosa", basePrice: "120.00", taxClass: "GST_5", isVeg: true });

    const off = await svc.setSoldOut(item.id, OUTLET_A, true);
    expect(off.soldOutHere).toBe(true);
    expect(off.isActive).toBe(false);

    const atA = (await svc.listItems({ outletId: OUTLET_A }))[0]!;
    expect(atA.isActive).toBe(false);
    expect(atA.soldOutHere).toBe(true);

    // The brand-wide flag is untouched — an admin listing (no outlet) still sees it on.
    const everywhere = (await svc.listItems({}))[0]!;
    expect(everywhere.isActive).toBe(true);
    expect(everywhere.soldOutHere).toBe(false);

    const back = await svc.setSoldOut(item.id, OUTLET_A, false);
    expect(back.isActive).toBe(true);
  });
});

test("a pinned captain cannot mark a dish sold out at another outlet", async () => {
  const repo = makeFakeRepo();
  const svc = makeMenuService({ repo, events: new InMemoryEventBus(), country: () => "IN" });
  let itemId = "";
  await runWithContext(ctx, async () => {
    const cat = await svc.createCategory({ name: "Dosa" });
    itemId = (await svc.createItem({ categoryId: cat.id, name: "Plain", basePrice: "90.00", taxClass: "GST_5", isVeg: true })).id;
  });
  await runWithContext({ ...ctx, role: "manager" as const, outletId: OUTLET_A }, async () => {
    await expect(svc.setSoldOut(itemId, OUTLET_B, true)).rejects.toThrow(/out of scope/);
    await expect(svc.listItems({ outletId: OUTLET_B })).rejects.toThrow(/out of scope/);
  });
});
