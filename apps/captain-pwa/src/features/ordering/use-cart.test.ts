import { expect, test } from "bun:test";
import {
  addLine,
  decodeCart,
  encodeCart,
  subtotalOf,
  type CartItem,
  type NewCartItem,
} from "./use-cart.ts";

const dosa = (over: Partial<NewCartItem> = {}): NewCartItem => ({
  itemId: "i-1",
  itemName: "Masala Dosa",
  unitPriceMinor: 12000n,
  taxClass: "GST_5",
  isVeg: true,
  modifiers: [],
  ...over,
});

test("the same line merges", () => {
  const cart = addLine(addLine([], dosa()), dosa());
  expect(cart).toHaveLength(1);
  expect(cart[0]?.qty).toBe(2);
});

test("a kitchen note keeps the line separate", () => {
  const cart = addLine(addLine([], dosa()), dosa({ note: "no onion" }));
  expect(cart.map((i) => i.qty)).toEqual([1, 1]);
});

test("modifiers and qty price in minor units", () => {
  const cart = addLine([], {
    ...dosa({ unitPriceMinor: 15050n }),
    qty: 3,
    modifiers: [{ id: "m1", name: "Extra ghee", priceDeltaMinor: 500n }],
  });
  expect(subtotalOf(cart)).toBe(46650n);
});

test("a stored cart round-trips with its bigints intact", () => {
  const cart: CartItem[] = addLine([], {
    ...dosa({ note: "less spicy" }),
    modifiers: [{ id: "m1", name: "Extra ghee", priceDeltaMinor: 500n }],
  });
  const back = decodeCart(encodeCart(cart));
  expect(back[0]?.unitPriceMinor).toBe(12000n);
  expect(back[0]?.modifiers[0]?.priceDeltaMinor).toBe(500n);
  expect(back[0]?.note).toBe("less spicy");
  expect(subtotalOf(back)).toBe(subtotalOf(cart));
});

test("junk in storage is an empty cart, not a crash", () => {
  expect(decodeCart(null)).toEqual([]);
  expect(decodeCart("{not json")).toEqual([]);
});
