/*
 * Prices an order on the device exactly the way apps/api/modules/billing does:
 * line = unit × qty, tax per line by class, rows bucketed by (component, rate).
 * The cloud re-prices on sync and refuses a mismatch, so the two must agree.
 */
import { Money } from "@odr/shared";
import { getTaxStrategy, fiscalYearFor } from "@odr/tax";
import type { Bill, Order } from "../../lib/api.ts";

// ponytail: mirrors repo.drizzle outletPrefixAndCurrency, which hardcodes INR.
export const CURRENCY = "INR" as const;

export const buildLocalBill = (input: {
  id: string;
  order: Order;
  invoiceNumber: string;
  fiscalYear: string;
  country: string;
  settledAt: string;
  customerName?: string;
  customerPhone?: string;
}): Bill => {
  const tax = getTaxStrategy(input.country);
  const rows = new Map<string, { name: string; rate: number; amountMinor: bigint }>();
  let subtotal = 0n;
  let taxTotal = 0n;
  const lines = input.order.lines.map((l) => {
    const lineSubtotal = BigInt(l.unitPriceMinor) * BigInt(l.qty);
    let lineTax = 0n;
    for (const c of tax.compute(Money.fromMinor(lineSubtotal, CURRENCY), l.taxClass, { interstate: false }).components) {
      lineTax += c.amount.minor;
      const key = `${c.name}@${c.rate}`;
      rows.set(key, { name: c.name, rate: c.rate, amountMinor: (rows.get(key)?.amountMinor ?? 0n) + c.amount.minor });
    }
    subtotal += lineSubtotal;
    taxTotal += lineTax;
    return { itemName: l.itemName, qty: l.qty, unitPriceMinor: l.unitPriceMinor, lineSubtotalMinor: String(lineSubtotal) };
  });
  return {
    id: input.id,
    outletId: input.order.outletId,
    orderId: input.order.id,
    invoiceNumber: input.invoiceNumber,
    fiscalYear: input.fiscalYear,
    currency: CURRENCY,
    subtotalMinor: String(subtotal),
    taxTotalMinor: String(taxTotal),
    grandTotalMinor: String(subtotal + taxTotal),
    taxBreakdown: [...rows.values()]
      .map((r) => ({ name: r.name, rate: r.rate, amountMinor: String(r.amountMinor) }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.rate - b.rate),
    customerName: input.customerName ?? null,
    customerPhone: input.customerPhone ?? null,
    settledAt: input.settledAt,
    lines,
  };
};

export { fiscalYearFor };
