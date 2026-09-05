import { test, expect } from "bun:test";
import { addSummaries, dayBounds, presetDays, previousDays, summarize } from "./sales.ts";
import type { Bill } from "../../lib/api.ts";

const bill = (channel: Bill["channel"], grand: string, tax: { name: string; rate: number; amountMinor: string }[]): Bill => ({
  id: crypto.randomUUID(), outletId: "o", orderId: "x", invoiceNumber: "n", fiscalYear: "2026-27", currency: "INR",
  subtotalMinor: String(BigInt(grand) - tax.reduce((a, t) => a + BigInt(t.amountMinor), 0n)),
  taxTotalMinor: String(tax.reduce((a, t) => a + BigInt(t.amountMinor), 0n)),
  grandTotalMinor: grand, taxBreakdown: tax, customerName: null, customerPhone: null, channel, settledAt: "2026-09-05T10:00:00.000Z", lines: [],
});

test("device bills sum per channel and per (component, rate), then merge with the cloud", () => {
  const device = summarize([
    bill("parcel", "10500", [{ name: "CGST", rate: 0.025, amountMinor: "250" }, { name: "SGST", rate: 0.025, amountMinor: "250" }]),
    bill("dine_in", "11800", [{ name: "CGST", rate: 0.09, amountMinor: "900" }, { name: "SGST", rate: 0.09, amountMinor: "900" }]),
  ]);
  expect(device.count).toBe(2);
  expect(device.grandTotalMinor).toBe("22300");
  expect(device.taxTotalMinor).toBe("2300");
  expect(device.subtotalMinor).toBe("20000");

  const merged = addSummaries(
    { count: 3, subtotalMinor: "30000", taxTotalMinor: "1500", grandTotalMinor: "31500",
      byChannel: [{ channel: "parcel", count: 1, grandTotalMinor: "10500" }, { channel: "zomato", count: 2, grandTotalMinor: "21000" }],
      taxBreakdown: [{ name: "CGST", rate: 0.025, amountMinor: "750" }, { name: "SGST", rate: 0.025, amountMinor: "750" }] },
    device,
  );
  expect(merged.count).toBe(5);
  expect(merged.grandTotalMinor).toBe("53800");
  expect(merged.byChannel).toEqual([
    { channel: "zomato", count: 2, grandTotalMinor: "21000" },
    { channel: "parcel", count: 2, grandTotalMinor: "21000" },
    { channel: "dine_in", count: 1, grandTotalMinor: "11800" },
  ]);
  expect(merged.taxBreakdown.map((t) => `${t.name}@${t.rate}=${t.amountMinor}`)).toEqual([
    "CGST@0.025=1000", "CGST@0.09=900", "SGST@0.025=1000", "SGST@0.09=900",
  ]);
});

test("presets and previous period run on the local calendar", () => {
  const sat = new Date(2026, 8, 5, 15, 30); // Saturday 5 Sep 2026
  expect(presetDays("today", sat)).toEqual({ from: "2026-09-05", to: "2026-09-05" });
  expect(presetDays("yesterday", sat)).toEqual({ from: "2026-09-04", to: "2026-09-04" });
  expect(presetDays("week", sat)).toEqual({ from: "2026-08-31", to: "2026-09-05" });
  expect(presetDays("month", sat)).toEqual({ from: "2026-09-01", to: "2026-09-05" });
  expect(previousDays({ from: "2026-09-01", to: "2026-09-05" })).toEqual({ from: "2026-08-27", to: "2026-08-31" });
  const b = dayBounds({ from: "2026-09-05", to: "2026-09-05" });
  expect(new Date(b.to).getTime() - new Date(b.from).getTime()).toBe(86_400_000 - 1);
});
