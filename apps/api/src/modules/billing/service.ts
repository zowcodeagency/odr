import { ConflictError, ForbiddenError, NotFoundError, newId, type Currency } from "@odr/shared";
import { can } from "@odr/auth";
import { Money } from "@odr/shared";
import { getTaxStrategy } from "@odr/tax";
import type { EventBus } from "@odr/events";
import { assertOutletScope, getContext } from "@odr/tenancy";
import type { BillingRepo, BillInsert } from "./ports.ts";
import { fiscalYearFor, type Bill, type BillLine } from "./domain.ts";

// Minimal projection of an Order this module needs to settle a bill.
// The ordering module passes this in via the event payload or a direct lookup.
export type SettleableOrder = {
  id: string;
  outletId: string;
  state: string;
  lines: Array<{
    itemId: string;
    itemName: string;
    qty: number;
    unitPriceMinor: bigint;
    taxClass: string;
  }>;
};

export interface OrderLookup {
  byIdForBilling(tenantId: string, orderId: string): Promise<SettleableOrder | null>;
}

export type BillingServiceDeps = {
  repo: BillingRepo;
  events: EventBus;
  country: () => string;
  orders: OrderLookup;
  /** Optional: defaults to (tenant, outlet) is intrastate. Wire interstate logic when multi-state arrives. */
  isInterstate?: (tenantId: string, outletId: string) => Promise<boolean>;
};

export const makeBillingService = ({ repo, events, country, orders, isInterstate }: BillingServiceDeps) => ({
  async settleOrderToBill(input: { orderId: string; customerName?: string; customerPhone?: string }): Promise<Bill> {
    const ctx = getContext();
    if (!can(ctx.role, "billing:settle")) throw new ForbiddenError("cannot settle bills");

    const existing = await repo.byOrderId(ctx.tenantId, input.orderId);
    if (existing) {
      assertOutletScope(existing.outletId);
      // Idempotent — settle is at-least-once, and the order.settled event
      // already materialised this bill without customer details. Fill them in
      // now rather than dropping what the cashier just typed.
      const wants = input.customerName ?? input.customerPhone;
      if (wants && !existing.customerName && !existing.customerPhone) {
        return (
          (await repo.setCustomer(ctx.tenantId, existing.id, {
            customerName: input.customerName ?? null,
            customerPhone: input.customerPhone ?? null,
          })) ?? existing
        );
      }
      return existing;
    }

    const order = await orders.byIdForBilling(ctx.tenantId, input.orderId);
    if (!order) throw new NotFoundError("order", input.orderId);
    assertOutletScope(order.outletId);
    if (order.state !== "settled") {
      throw new ConflictError("order must be in 'settled' state to be billed", { orderId: order.id, state: order.state });
    }

    const meta = await repo.outletPrefixAndCurrency(ctx.tenantId, order.outletId);
    if (!meta) throw new NotFoundError("outlet", order.outletId);
    const currency = meta.currency as Currency;

    const tax = getTaxStrategy(country());
    const interstate = isInterstate ? await isInterstate(ctx.tenantId, order.outletId) : false;
    const fiscalYear = fiscalYearFor(new Date(), tax.country);

    let subtotalMinor = 0n;
    let taxTotalMinor = 0n;
    // Bucket by (component name, rate) so e.g. CGST@2.5% (5% items) and CGST@9% (18% items)
    // appear as separate rows on the invoice — GST-compliant aggregation.
    const componentTotals = new Map<string, { name: string; rate: number; amountMinor: bigint }>();
    const billLines: Array<Omit<BillLine, "id">> = [];

    for (const line of order.lines) {
      const lineSubtotalMinor = line.unitPriceMinor * BigInt(line.qty);
      const baseMoney = Money.fromMinor(lineSubtotalMinor, currency);
      const breakdown = tax.compute(baseMoney, line.taxClass, { interstate });

      let lineTaxMinor = 0n;
      for (const c of breakdown.components) {
        lineTaxMinor += c.amount.minor;
        const key = `${c.name}@${c.rate}`;
        const prev = componentTotals.get(key);
        componentTotals.set(key, {
          name: c.name,
          rate: c.rate,
          amountMinor: (prev?.amountMinor ?? 0n) + c.amount.minor,
        });
      }

      subtotalMinor += lineSubtotalMinor;
      taxTotalMinor += lineTaxMinor;

      billLines.push({
        itemId: line.itemId,
        itemName: line.itemName,
        qty: line.qty,
        unitPriceMinor: line.unitPriceMinor,
        taxClass: line.taxClass,
        lineSubtotalMinor,
        lineTaxMinor,
      });
    }

    const insert: BillInsert = {
      id: newId(),
      tenantId: ctx.tenantId,
      outletId: order.outletId,
      orderId: order.id,
      invoiceNumber: "", // assigned inside reserveAndCreate
      fiscalYear,
      currency,
      subtotalMinor,
      taxTotalMinor,
      grandTotalMinor: subtotalMinor + taxTotalMinor,
      taxBreakdown: [...componentTotals.values()]
        .map((v) => ({ name: v.name, rate: v.rate, amountMinor: v.amountMinor.toString() }))
        .sort((a, b) => a.name.localeCompare(b.name) || a.rate - b.rate),
      lines: billLines,
      customerName: input.customerName ?? null,
      customerPhone: input.customerPhone ?? null,
    };

    const bill = await repo.reserveAndCreate(insert, meta.prefix);

    await events.publish({
      name: "bill.created",
      tenantId: ctx.tenantId,
      occurredAt: new Date().toISOString(),
      payload: { billId: bill.id, orderId: bill.orderId, invoiceNumber: bill.invoiceNumber, grandTotalMinor: bill.grandTotalMinor.toString() },
    });

    return bill;
  },

  async byId(id: string) {
    const ctx = getContext();
    const bill = await repo.byId(ctx.tenantId, id);
    if (!bill) return null;
    assertOutletScope(bill.outletId);
    return bill;
  },

  /** One outlet, or every outlet the caller may see (unpinned roles only). */
  async list(opts: { outletId?: string; from?: string; to?: string; limit?: number }) {
    const ctx = getContext();
    if (!can(ctx.role, "billing:read")) throw new ForbiddenError("cannot read bills");
    if (opts.outletId) assertOutletScope(opts.outletId);
    else if (ctx.outletId) throw new ForbiddenError("outlet out of scope");
    // ponytail: capped list, no cursor. Add paging when a shift exceeds 500 bills.
    return repo.list(ctx.tenantId, { ...opts, limit: Math.min(opts.limit ?? 200, 500) });
  },
});

export type BillingService = ReturnType<typeof makeBillingService>;
