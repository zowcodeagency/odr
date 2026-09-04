import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import type { DB } from "@odr/db";
import { orders, orderLines, kots } from "@odr/db/schema";
import type { OrderRepo, KotView } from "./ports.ts";
import { OPEN_STATES, type Kot, type Order, type OrderChannel, type OrderLine, type OrderState } from "./domain.ts";

type OrderRow = typeof orders.$inferSelect;
type LineRow = typeof orderLines.$inferSelect;
type KotRow = typeof kots.$inferSelect;

const iso = (d: Date | null): string | undefined => (d ? d.toISOString() : undefined);

const toLine = (r: LineRow): OrderLine => ({
  id: r.id,
  itemId: r.itemId,
  itemName: r.itemName,
  qty: r.qty,
  unitPriceMinor: BigInt(r.unitPriceMinor),
  taxClass: r.taxClass,
  ...(r.note ? { note: r.note } : {}),
  modifiers: (r.modifiers ?? []).map((m) => ({ id: m.id, name: m.name, priceDeltaMinor: BigInt(m.priceDeltaMinor) })),
});

const toKot = (r: KotRow, lineIds: string[]): Kot => ({
  id: r.id,
  number: r.number,
  firedAt: r.firedAt.toISOString(),
  ...(r.doneAt ? { doneAt: r.doneAt.toISOString() } : {}),
  lineIds,
});

const assemble = (o: OrderRow, lines: LineRow[], kotRows: KotRow[]): Order => ({
  id: o.id,
  tenantId: o.tenantId,
  outletId: o.outletId,
  tableLabel: o.tableLabel,
  channel: o.channel as OrderChannel,
  customerName: o.customerName,
  aggregatorRef: o.aggregatorRef,
  state: o.state as OrderState,
  lines: lines.filter((l) => l.orderId === o.id).map(toLine),
  kots: kotRows
    .filter((k) => k.orderId === o.id)
    .map((k) => toKot(k, lines.filter((l) => l.kotId === k.id).map((l) => l.id))),
  openedAt: o.openedAt.toISOString(),
  ...(o.kotFiredAt ? { kotFiredAt: iso(o.kotFiredAt) } : {}),
  ...(o.settledAt ? { settledAt: iso(o.settledAt) } : {}),
});

const kotViews = (rows: Array<{ kot: KotRow; order: OrderRow }>, lines: LineRow[]): KotView[] =>
  rows.map(({ kot, order }) => ({
    id: kot.id,
    orderId: order.id,
    number: kot.number,
    tableLabel: order.tableLabel,
    channel: order.channel,
    firedAt: kot.firedAt.toISOString(),
    doneAt: kot.doneAt ? kot.doneAt.toISOString() : null,
    lines: lines
      .filter((l) => l.kotId === kot.id)
      .map((l) => ({ itemName: l.itemName, qty: l.qty, note: l.note })),
  }));

export const drizzleOrderRepo = (db: DB): OrderRepo => {
  const linesFor = (orderIds: string[]) =>
    orderIds.length === 0
      ? Promise.resolve([] as LineRow[])
      : db.select().from(orderLines).where(inArray(orderLines.orderId, orderIds));

  const loadKotViews = async (tenantId: string, where: ReturnType<typeof and>): Promise<KotView[]> => {
    const rows = await db
      .select({ kot: kots, order: orders })
      .from(kots)
      .innerJoin(orders, eq(orders.id, kots.orderId))
      .where(and(eq(kots.tenantId, tenantId), where))
      .orderBy(kots.firedAt);
    if (rows.length === 0) return [];
    const lines = await db
      .select()
      .from(orderLines)
      .where(inArray(orderLines.kotId, rows.map((r) => r.kot.id)));
    return kotViews(rows, lines);
  };

  const kotById = async (tenantId: string, kotId: string): Promise<KotView | null> =>
    (await loadKotViews(tenantId, eq(kots.id, kotId)))[0] ?? null;

  return {
    async byId(tenantId, id) {
      const [o] = await db
        .select()
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.id, id)))
        .limit(1);
      if (!o) return null;
      const [lines, kotRows] = await Promise.all([
        linesFor([o.id]),
        db.select().from(kots).where(eq(kots.orderId, o.id)).orderBy(kots.number),
      ]);
      return assemble(o, lines, kotRows);
    },

    async insert(order) {
      await db.insert(orders).values({
        id: order.id,
        tenantId: order.tenantId,
        outletId: order.outletId,
        tableLabel: order.tableLabel,
        state: order.state,
        channel: order.channel,
        customerName: order.customerName ?? null,
        aggregatorRef: order.aggregatorRef ?? null,
        openedAt: new Date(order.openedAt),
      });
      return order;
    },

    // Diff-and-append: order rows are updated in place, lines and kots are
    // append-only (the FSM never removes either), so we insert whatever the
    // aggregate has that the DB doesn't.
    async save(order) {
      await db.transaction(async (tx) => {
        await tx
          .update(orders)
          .set({
            state: order.state,
            tableLabel: order.tableLabel,
            channel: order.channel,
            customerName: order.customerName ?? null,
            aggregatorRef: order.aggregatorRef ?? null,
            kotFiredAt: order.kotFiredAt ? new Date(order.kotFiredAt) : null,
            settledAt: order.settledAt ? new Date(order.settledAt) : null,
          })
          .where(and(eq(orders.tenantId, order.tenantId), eq(orders.id, order.id)));

        const knownLines = new Set(
          (await tx.select({ id: orderLines.id }).from(orderLines).where(eq(orderLines.orderId, order.id))).map((r) => r.id),
        );
        const newLines = order.lines.filter((l) => !knownLines.has(l.id));
        if (newLines.length > 0) {
          await tx.insert(orderLines).values(
            newLines.map((l) => ({
              id: l.id,
              tenantId: order.tenantId,
              orderId: order.id,
              itemId: l.itemId,
              itemName: l.itemName,
              qty: l.qty,
              unitPriceMinor: l.unitPriceMinor.toString(),
              taxClass: l.taxClass,
              note: l.note ?? null,
              modifiers: l.modifiers.map((m) => ({ id: m.id, name: m.name, priceDeltaMinor: m.priceDeltaMinor.toString() })),
            })),
          );
        }

        const knownKots = new Set(
          (await tx.select({ id: kots.id }).from(kots).where(eq(kots.orderId, order.id))).map((r) => r.id),
        );
        for (const k of order.kots) {
          if (knownKots.has(k.id)) continue;
          await tx.insert(kots).values({
            id: k.id,
            tenantId: order.tenantId,
            outletId: order.outletId,
            orderId: order.id,
            number: k.number,
            firedAt: new Date(k.firedAt),
            doneAt: k.doneAt ? new Date(k.doneAt) : null,
          });
          if (k.lineIds.length > 0) {
            await tx.update(orderLines).set({ kotId: k.id }).where(inArray(orderLines.id, k.lineIds));
          }
        }
      });
      return order;
    },

    async listOpen(tenantId, outletId) {
      const open = await db
        .select()
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.outletId, outletId), inArray(orders.state, OPEN_STATES)))
        .orderBy(orders.openedAt);
      if (open.length === 0) return [];
      const ids = open.map((o) => o.id);
      const [lines, kotRows] = await Promise.all([
        linesFor(ids),
        db.select().from(kots).where(inArray(kots.orderId, ids)),
      ]);
      return open.map((o) => assemble(o, lines, kotRows));
    },

    // ponytail: per-outlet daily counter via COUNT — two captains firing in the
    // same millisecond can collide on a number. Kitchen tickets tolerate that;
    // swap in a sequence if it ever matters.
    async nextKotNumber(tenantId, outletId) {
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(kots)
        .where(and(eq(kots.tenantId, tenantId), eq(kots.outletId, outletId), gte(kots.firedAt, midnight)));
      return (row?.n ?? 0) + 1;
    },

    listPendingKots: (tenantId, outletId) =>
      loadKotViews(tenantId, and(eq(kots.outletId, outletId), isNull(kots.doneAt))),

    kotById,

    async markKotDone(tenantId, kotId) {
      await db
        .update(kots)
        .set({ doneAt: new Date() })
        .where(and(eq(kots.tenantId, tenantId), eq(kots.id, kotId), isNull(kots.doneAt)));
      return kotById(tenantId, kotId);
    },
  };
};
