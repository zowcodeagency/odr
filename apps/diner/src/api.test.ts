import { expect, test } from "bun:test";
import { minorOf, parseHash, rupees, stepOf } from "./api.ts";

test("parseHash reads the QR url, url-decoding the label", () => {
  expect(parseHash("#/o/out-1/t/T-3?k=abc123")).toEqual({
    outletId: "out-1",
    label: "T-3",
    token: "abc123",
  });
  expect(parseHash("#/o/out-1/t/Table%202?k=t")?.label).toBe("Table 2");
  expect(parseHash("#/o/out-1/t/T-3")).toBeNull(); // no token
  expect(parseHash("")).toBeNull();
});

test("minorOf accepts every price shape the API may send", () => {
  expect(minorOf({ priceMinor: 12000 })).toBe(12000);
  expect(minorOf({ priceMinor: "12000", price: "120.00" })).toBe(12000); // API sends strings
  expect(minorOf({ price: 120 })).toBe(12000);
  expect(minorOf({ price: "₹120.50" })).toBe(12050);
  expect(minorOf({ price: null })).toBe(0);
});

test("rupees shows paise only when there are paise", () => {
  expect(rupees(12000)).toBe("₹120");
  expect(rupees(12550)).toBe("₹125.50");
});

test("stepOf maps domain states to the diner's three steps", () => {
  expect(stepOf("open")).toBe(0);
  expect(stepOf("items_added")).toBe(0);
  expect(stepOf("kot_fired")).toBe(1);
  expect(stepOf("settled")).toBe(2);
});
