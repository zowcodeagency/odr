import { test, expect } from "bun:test";
import { InMemoryEventBus } from "@odr/events";
import { runWithContext } from "@odr/tenancy";
import { asTenantId, asUserId } from "@odr/shared";
import { makeMenuService } from "./service.ts";
import type { MenuRepo } from "./ports.ts";
import type { Category, Item } from "./domain.ts";

const TENANT = "11111111-1111-1111-1111-111111111111";
const OUTLET_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OUTLET_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const makeFakeRepo = (): MenuRepo & { _categories: Category[]; _items: Item[] } => {
  const _categories: Category[] = [];
  const _items: Item[] = [];
  const _images = new Map<string, { data: string; type: string }>();
  let i = 0;
  const newId = () => `cat-${++i}`;
  return {
    _categories,
    _items,
    async outletExistsInTenant(_t, id) {
      return id === OUTLET_A || id === OUTLET_B;
    },
    async listCategories(_t, outletId) {
      if (outletId === undefined) return [..._categories];
      return _categories.filter((c) => c.outletId === null || c.outletId === outletId);
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
    async listItems(_t, { categoryId, outletId }) {
      return _items.filter((it) =>
        (!categoryId || it.categoryId === categoryId) &&
        (!outletId || it.outletId === null || it.outletId === outletId)
      );
    },
    async createItem(_t, input) {
      const it: Item = {
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
