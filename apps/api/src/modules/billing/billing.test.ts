import { test, expect } from "bun:test";
import { InMemoryEventBus } from "@odr/events";
import { runWithContext } from "@odr/tenancy";
import { asTenantId, asUserId } from "@odr/shared";
import { makeBillingService, type OrderLookup, type SettleableOrder } from "./service.ts";
import type { BillingRepo } from "./ports.ts";
import { fiscalYearFor, formatInvoiceNumber, type Bill } from "./domain.ts";

const TENANT = "11111111-1111-1111-1111-111111111111";
const OUTLET = "33333333-3333-3333-3333-333333333333";

const ctx = { tenantId: asTenantId(TENANT), userId: asUserId("u-1"), role: "owner" as const };

const stubOrders = (orders: SettleableOrder[]): OrderLookup => ({
  byIdForBilling: async (_t, id) => orders.find((o) => o.id === id) ?? null,
});

const fakeRepo = (initialCounter = 0) => {
  let counter = initialCounter;
  const bills: Bill[] = [];
  const repo: BillingRepo = {
    async outletPrefixAndCurrency() {
      return { prefix: "MC", currency: "INR" };
    },
    async byId(_t, id) {
      return bills.find((b) => b.id === id) ?? null;
    },
    async byOrderId(_t, orderId) {
      return bills.find((b) => b.orderId === orderId) ?? null;
    },
    async setCustomer(_t, billId, c) {
      const b = bills.find((x) => x.id === billId);
      if (!b) return null;
      Object.assign(b, c);
      return b;
    },
    async list(_t, { outletId }) {
      return bills.filter((b) => b.outletId === outletId).map((b) => ({
        id: b.id, orderId: b.orderId, invoiceNumber: b.invoiceNumber, currency: b.currency,
        grandTotalMinor: b.grandTotalMinor, customerName: b.customerName,
        customerPhone: b.customerPhone, settledAt: b.settledAt,
      }));
    },
    async reserveAndCreate(input, prefix) {
      counter += 1;
      const bill: Bill = {
        id: input.id,
        outletId: input.outletId,
        orderId: input.orderId,
        invoiceNumber: formatInvoiceNumber(prefix, input.fiscalYear, counter),
        fiscalYear: input.fiscalYear,
        currency: input.currency as Bill["currency"],
        customerName: input.customerName ?? null,
        customerPhone: input.customerPhone ?? null,
        subtotalMinor: input.subtotalMinor,
        taxTotalMinor: input.taxTotalMinor,
        grandTotalMinor: input.grandTotalMinor,
        taxBreakdown: input.taxBreakdown,
        settledAt: new Date().toISOString(),
        lines: input.lines.map((l, i) => ({ ...l, id: `bl-${i}` })),
      };
      bills.push(bill);
      return bill;
    },
  };
  return { repo, bills };
};

const sampleOrder = (id: string, lines: SettleableOrder["lines"]): SettleableOrder => ({
  id,
  outletId: OUTLET,
  state: "settled",
  lines,
});

test("settle creates bill with GST_5 split into CGST + SGST and grand total = subtotal + tax", async () => {
  const { repo, bills } = fakeRepo();
  const svc = makeBillingService({
    repo,
    events: new InMemoryEventBus(),
    country: () => "IN",
    orders: stubOrders([
      sampleOrder("o-1", [
        { itemId: "i-1", itemName: "Masala Dosa", qty: 2, unitPriceMinor: 12000n, taxClass: "GST_5" },
      ]),
    ]),
  });

  await runWithContext(ctx, async () => {
    const bill = await svc.settleOrderToBill({ orderId: "o-1" });
    expect(bill.subtotalMinor).toBe(24000n); // 2 × 120.00 = 240.00
    expect(bill.taxTotalMinor).toBe(1200n);  // 5% of 240.00 = 12.00
    expect(bill.grandTotalMinor).toBe(25200n); // 252.00
    expect(bill.taxBreakdown.map((c) => c.name).sort()).toEqual(["CGST", "SGST"]);
    expect(bills).toHaveLength(1);
  });
});

test("settle is idempotent — second call returns the same bill", async () => {
  const { repo, bills } = fakeRepo();
  const svc = makeBillingService({
    repo,
    events: new InMemoryEventBus(),
    country: () => "IN",
    orders: stubOrders([
      sampleOrder("o-2", [{ itemId: "i-1", itemName: "Idli", qty: 1, unitPriceMinor: 5000n, taxClass: "GST_5" }]),
    ]),
  });

  await runWithContext(ctx, async () => {
    const a = await svc.settleOrderToBill({ orderId: "o-2" });
    const b = await svc.settleOrderToBill({ orderId: "o-2" });
    expect(a.id).toBe(b.id);
    expect(a.invoiceNumber).toBe(b.invoiceNumber);
    expect(bills).toHaveLength(1);
  });
});

test("invoice numbers are sequential per (outlet, fiscalYear) and follow PREFIX/YEAR/SEQ format", async () => {
  const { repo } = fakeRepo();
  const svc = makeBillingService({
    repo,
    events: new InMemoryEventBus(),
    country: () => "IN",
    orders: stubOrders([
      sampleOrder("o-A", [{ itemId: "i", itemName: "X", qty: 1, unitPriceMinor: 1000n, taxClass: "GST_5" }]),
      sampleOrder("o-B", [{ itemId: "i", itemName: "Y", qty: 1, unitPriceMinor: 1000n, taxClass: "GST_5" }]),
      sampleOrder("o-C", [{ itemId: "i", itemName: "Z", qty: 1, unitPriceMinor: 1000n, taxClass: "GST_5" }]),
    ]),
  });

  await runWithContext(ctx, async () => {
    const a = await svc.settleOrderToBill({ orderId: "o-A" });
    const b = await svc.settleOrderToBill({ orderId: "o-B" });
    const c = await svc.settleOrderToBill({ orderId: "o-C" });
    expect(a.invoiceNumber).toMatch(/^MC\/\d{4}-\d{2}\/00001$/);
    expect(b.invoiceNumber).toMatch(/00002$/);
    expect(c.invoiceNumber).toMatch(/00003$/);
  });
});

test("rejects orders not in 'settled' state", async () => {
  const { repo } = fakeRepo();
  const svc = makeBillingService({
    repo,
    events: new InMemoryEventBus(),
    country: () => "IN",
    orders: stubOrders([
      { ...sampleOrder("o-X", [{ itemId: "i", itemName: "X", qty: 1, unitPriceMinor: 1000n, taxClass: "GST_5" }]), state: "open" },
    ]),
  });
  await runWithContext(ctx, async () => {
    await expect(svc.settleOrderToBill({ orderId: "o-X" })).rejects.toThrow(/must be in 'settled' state/);
  });
});

test("mixed-rate orders produce one breakdown row per (component, rate) pair", async () => {
  const { repo } = fakeRepo();
  const svc = makeBillingService({
    repo,
    events: new InMemoryEventBus(),
    country: () => "IN",
    orders: stubOrders([
      sampleOrder("o-mix", [
        { itemId: "i-dosa", itemName: "Masala Dosa", qty: 2, unitPriceMinor: 12000n, taxClass: "GST_5" },
        { itemId: "i-coffee", itemName: "Filter Coffee", qty: 1, unitPriceMinor: 4000n, taxClass: "GST_18" },
      ]),
    ]),
  });

  await runWithContext(ctx, async () => {
    const bill = await svc.settleOrderToBill({ orderId: "o-mix" });
    // Expect 4 rows: CGST@2.5%, CGST@9%, SGST@2.5%, SGST@9% — sorted by (name, rate).
    expect(bill.taxBreakdown).toHaveLength(4);
    const buckets = bill.taxBreakdown.map((c) => `${c.name}@${c.rate}=${c.amountMinor}`);
    expect(buckets).toEqual([
      "CGST@0.025=600",   // 2.5% of ₹240 dosa = ₹6.00
      "CGST@0.09=360",    // 9% of ₹40 coffee = ₹3.60
      "SGST@0.025=600",
      "SGST@0.09=360",
    ]);
    expect(bill.taxTotalMinor).toBe(1920n); // ₹19.20 total
  });
});

test("Indian fiscal year wraps Apr-Mar correctly", () => {
  expect(fiscalYearFor(new Date("2026-04-01T00:00:00Z"), "IN")).toBe("2026-27");
  expect(fiscalYearFor(new Date("2026-03-31T00:00:00Z"), "IN")).toBe("2025-26");
  expect(fiscalYearFor(new Date("2026-06-15T00:00:00Z"), "IN")).toBe("2026-27");
  expect(fiscalYearFor(new Date("2026-06-15T00:00:00Z"), "SA")).toBe("2026");
});

test("the event auto-bills first; a later settle with a phone fills it in", async () => {
  const { repo } = fakeRepo();
  const svc = makeBillingService({
    repo,
    events: new InMemoryEventBus(),
    country: () => "IN",
    orders: stubOrders([
      sampleOrder("o-9", [{ itemId: "i-1", itemName: "Idli", qty: 1, unitPriceMinor: 5000n, taxClass: "GST_5" }]),
    ]),
  });

  await runWithContext(ctx, async () => {
    // What the order.settled listener does — no customer details.
    const auto = await svc.settleOrderToBill({ orderId: "o-9" });
    expect(auto.customerPhone).toBe(null);

    // What the cashier's Settle dialog does a moment later.
    const withPhone = await svc.settleOrderToBill({
      orderId: "o-9",
      customerName: "Rakesh",
      customerPhone: "9845012345",
    });
    expect(withPhone.id).toBe(auto.id);            // same invoice, not a second one
    expect(withPhone.customerPhone).toBe("9845012345");
  });
});
