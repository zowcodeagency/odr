import { test, expect } from "bun:test";
import { buildLocalBill } from "./local-bill.ts";
import type { Order } from "../../lib/api.ts";

const order: Order = {
  id: "o-1",
  outletId: "out-1",
  tableLabel: "T-1",
  state: "settled",
  openedAt: "2026-09-04T09:00:00.000Z",
  lines: [
    { id: "l1", itemId: "i1", itemName: "Masala Dosa", qty: 2, unitPriceMinor: "12000", taxClass: "GST_5", modifiers: [] },
    { id: "l2", itemId: "i2", itemName: "Filter Coffee", qty: 1, unitPriceMinor: "4000", taxClass: "GST_18", modifiers: [] },
  ],
};

// Same numbers as the API's "mixed-rate orders" test — the cloud must agree on sync.
test("device pricing matches the cloud: totals and one row per (component, rate)", () => {
  const bill = buildLocalBill({
    id: "b-1", order, invoiceNumber: "MC/2026-27/LK7-00001", fiscalYear: "2026-27",
    country: "IN", settledAt: "2026-09-04T10:00:00.000Z",
  });
  expect(bill.subtotalMinor).toBe("28000");
  expect(bill.taxTotalMinor).toBe("1920");
  expect(bill.grandTotalMinor).toBe("29920");
  expect(bill.taxBreakdown.map((c) => `${c.name}@${c.rate}=${c.amountMinor}`)).toEqual([
    "CGST@0.025=600", "CGST@0.09=360", "SGST@0.025=600", "SGST@0.09=360",
  ]);
  expect(bill.lines[0]!.lineSubtotalMinor).toBe("24000");
});
