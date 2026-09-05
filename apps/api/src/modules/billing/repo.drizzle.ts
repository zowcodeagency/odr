import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { DB } from "@odr/db";
import { bills, billLines, orders, outlets } from "@odr/db/schema";
import { ConflictError } from "@odr/shared";
import type { BillInsert, BillingRepo } from "./ports.ts";
import { formatInvoiceNumber, type Bill, type BillLine, type BillSummary, type SalesSummary } from "./domain.ts";

const toDomain = (b: typeof bills.$inferSelect, lines: BillLine[], tableLabel?: string | null): Bill => ({
  ...(tableLabel !== undefined ? { tableLabel } : {}),
  id: b.id,
  outletId: b.outletId,
  orderId: b.orderId,
  invoiceNumber: b.invoiceNumber,
  fiscalYear: b.fiscalYear,
  currency: b.currency as Bill["currency"],
  subtotalMinor: BigInt(b.subtotalMinor),
  taxTotalMinor: BigInt(b.taxTotalMinor),
  grandTotalMinor: BigInt(b.grandTotalMinor),
  taxBreakdown: b.taxBreakdown,
  customerName: b.customerName,
  customerPhone: b.customerPhone,
  channel: b.channel,
  settledAt: b.settledAt.toISOString(),
  lines,
});

const lineToDomain = (l: typeof billLines.$inferSelect): BillLine => ({
  id: l.id,
  itemId: l.itemId,
  itemName: l.itemName,
  qty: l.qty,
  unitPriceMinor: BigInt(l.unitPriceMinor),
  taxClass: l.taxClass,
  lineSubtotalMinor: BigInt(l.lineSubtotalMinor),
  lineTaxMinor: BigInt(l.lineTaxMinor),
});

/** The list and the summary must agree on which bills they cover. */
const inRange = (tenantId: string, { outletId, from, to }: { outletId?: string; from?: string; to?: string }) =>
  and(
    eq(bills.tenantId, tenantId),
    ...(outletId ? [eq(bills.outletId, outletId)] : []),
    ...(from ? [gte(bills.settledAt, new Date(from))] : []),
    ...(to ? [lte(bills.settledAt, new Date(to))] : []),
  );

export const drizzleBillingRepo = (db: DB): BillingRepo => ({
  async outletPrefixAndCurrency(tenantId, outletId) {
    const rows = await db
      .select({ prefix: outlets.invoicePrefix, currency: sql<string>`'INR'` })
      .from(outlets)
      .where(and(eq(outlets.tenantId, tenantId), eq(outlets.id, outletId)))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return { prefix: r.prefix, currency: r.currency };
  },

  async byId(tenantId, id) {
    // Bill, its table and its lines in one round trip each, in parallel.
    const [[row], ls] = await Promise.all([
      db
        .select({ bill: bills, tableLabel: orders.tableLabel })
        .from(bills)
        .leftJoin(orders, eq(orders.id, bills.orderId))
        .where(and(eq(bills.tenantId, tenantId), eq(bills.id, id)))
        .limit(1),
      db.select().from(billLines).where(eq(billLines.billId, id)),
    ]);
    if (!row) return null;
    return toDomain(row.bill, ls.map(lineToDomain), row.tableLabel ?? null);
  },

  async list(tenantId, { outletId, from, to, limit }) {
    const rows = await db
      .select({
        id: bills.id,
        outletId: bills.outletId,
        orderId: bills.orderId,
        invoiceNumber: bills.invoiceNumber,
        currency: bills.currency,
        grandTotalMinor: bills.grandTotalMinor,
        customerName: bills.customerName,
        customerPhone: bills.customerPhone,
        channel: bills.channel,
        settledAt: bills.settledAt,
      })
      .from(bills)
      .where(inRange(tenantId, { outletId, from, to }))
      .orderBy(desc(bills.settledAt))
      .limit(limit);
    return rows.map((r) => ({
      ...r,
      currency: r.currency as BillSummary["currency"],
      grandTotalMinor: BigInt(r.grandTotalMinor),
      settledAt: r.settledAt.toISOString(),
    }));
  },

  async summary(tenantId, opts) {
    const where = inRange(tenantId, opts);
    const [channels, taxRows] = await Promise.all([
      db
        .select({
          channel: bills.channel,
          count: sql<number>`count(*)::int`,
          subtotalMinor: sql<string>`coalesce(sum(${bills.subtotalMinor}), 0)::text`,
          taxTotalMinor: sql<string>`coalesce(sum(${bills.taxTotalMinor}), 0)::text`,
          grandTotalMinor: sql<string>`coalesce(sum(${bills.grandTotalMinor}), 0)::text`,
        })
        .from(bills)
        .where(where)
        .groupBy(bills.channel),
      // One row per (component, rate) across the range — the same buckets each invoice prints.
      db.execute(sql`
        SELECT c->>'name' AS name, (c->>'rate')::float8 AS rate, sum((c->>'amountMinor')::numeric)::text AS amount_minor
        FROM ${bills}, jsonb_array_elements(${bills.taxBreakdown}) AS c
        WHERE ${where}
        GROUP BY 1, 2
        ORDER BY 1, 2
      `) as unknown as Promise<{ name: string; rate: number; amount_minor: string }[]>,
    ]);
    const sum = (k: "subtotalMinor" | "taxTotalMinor" | "grandTotalMinor") =>
      channels.reduce((a, r) => a + BigInt(r[k]), 0n);
    return {
      count: channels.reduce((a, r) => a + r.count, 0),
      subtotalMinor: sum("subtotalMinor"),
      taxTotalMinor: sum("taxTotalMinor"),
      grandTotalMinor: sum("grandTotalMinor"),
      byChannel: channels
        .map((r) => ({ channel: r.channel, count: r.count, grandTotalMinor: BigInt(r.grandTotalMinor) }))
        .sort((a, b) => (a.grandTotalMinor < b.grandTotalMinor ? 1 : -1)),
      taxBreakdown: [...taxRows].map((t) => ({ name: t.name, rate: Number(t.rate), amountMinor: BigInt(t.amount_minor) })),
    } satisfies SalesSummary;
  },

  async byOrderId(tenantId, orderId) {
    const [b] = await db
      .select()
      .from(bills)
      .where(and(eq(bills.tenantId, tenantId), eq(bills.orderId, orderId)))
      .limit(1);
    if (!b) return null;
    const ls = await db.select().from(billLines).where(eq(billLines.billId, b.id));
    return toDomain(b, ls.map(lineToDomain));
  },

  async setCustomer(tenantId, billId, c) {
    await db
      .update(bills)
      .set(c)
      .where(and(eq(bills.tenantId, tenantId), eq(bills.id, billId)));
    return this.byId(tenantId, billId);
  },

  async reserveAndCreate(input, prefix) {
    return db.transaction(async (tx) => {
      let invoiceNumber = input.invoiceNumber;
      if (!invoiceNumber) {
        // Lock the outlet row to serialize invoice numbering for this (outlet, fiscalYear).
        const locked = await tx.execute(sql`
          SELECT invoice_counter FROM outlets
          WHERE id = ${input.outletId} AND tenant_id = ${input.tenantId}
          FOR UPDATE
        `);
        // Drizzle's execute returns driver-shaped rows; bun-sql gives us an array.
        const counterRow = (locked as unknown as { invoice_counter: string }[])[0];
        if (!counterRow) throw new ConflictError("outlet vanished mid-tx");

        // The invoice_counter is naive — global per outlet. Per-fiscal-year
        // counters live in a future iteration when the volume justifies an
        // (outlet_id, fiscal_year) sequence table. For MVP, prefix the format
        // with fiscalYear so collisions across years are still impossible.
        const next = Number(counterRow.invoice_counter) + 1;
        invoiceNumber = formatInvoiceNumber(prefix, input.fiscalYear, next);

        await tx
          .update(outlets)
          .set({ invoiceCounter: String(next) })
          .where(and(eq(outlets.id, input.outletId), eq(outlets.tenantId, input.tenantId)));
      }

      const [billRow] = await tx
        .insert(bills)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          outletId: input.outletId,
          orderId: input.orderId,
          invoiceNumber,
          fiscalYear: input.fiscalYear,
          currency: input.currency,
          subtotalMinor: input.subtotalMinor.toString(),
          taxTotalMinor: input.taxTotalMinor.toString(),
          grandTotalMinor: input.grandTotalMinor.toString(),
          taxBreakdown: input.taxBreakdown,
          customerName: input.customerName ?? null,
          customerPhone: input.customerPhone ?? null,
          channel: input.channel,
          ...(input.settledAt ? { settledAt: new Date(input.settledAt) } : {}),
        })
        .returning();
      if (!billRow) throw new Error("failed to insert bill");

      const lineRows = input.lines.length > 0
        ? await tx
            .insert(billLines)
            .values(input.lines.map((l) => ({
              tenantId: input.tenantId,
              billId: billRow.id,
              itemId: l.itemId,
              itemName: l.itemName,
              qty: l.qty,
              unitPriceMinor: l.unitPriceMinor.toString(),
              taxClass: l.taxClass,
              lineSubtotalMinor: l.lineSubtotalMinor.toString(),
              lineTaxMinor: l.lineTaxMinor.toString(),
            })))
            .returning()
        : [];

      return toDomain(billRow, lineRows.map(lineToDomain));
    });
  },
});
