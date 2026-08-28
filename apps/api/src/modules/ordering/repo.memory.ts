import type { OrderRepo, KotView } from "./ports.ts";
import type { Order } from "./domain.ts";
import { isOpenState } from "./domain.ts";

/** Test double for the FSM. Production wiring uses repo.drizzle.ts. */
export const inMemoryOrderRepo = (): OrderRepo => {
  const store = new Map<string, Order>();
  const key = (t: string, id: string) => `${t}:${id}`;
  const mine = (tenantId: string) => [...store.values()].filter((o) => o.tenantId === tenantId);

  const view = (o: Order, kotId: string): KotView | null => {
    const k = o.kots.find((x) => x.id === kotId);
    if (!k) return null;
    const ids = new Set(k.lineIds);
    return {
      id: k.id,
      orderId: o.id,
      number: k.number,
      tableLabel: o.tableLabel,
      channel: o.channel,
      firedAt: k.firedAt,
      doneAt: k.doneAt ?? null,
      lines: o.lines.filter((l) => ids.has(l.id)).map((l) => ({ itemName: l.itemName, qty: l.qty, note: l.note ?? null })),
    };
  };

  return {
    async byId(tenantId, id) {
      return store.get(key(tenantId, id)) ?? null;
    },
    async insert(order) {
      store.set(key(order.tenantId, order.id), order);
      return order;
    },
    async save(order) {
      store.set(key(order.tenantId, order.id), order);
      return order;
    },
    async listOpen(tenantId, outletId) {
      return mine(tenantId).filter((o) => o.outletId === outletId && isOpenState(o.state));
    },
    async nextKotNumber(tenantId, outletId) {
      return mine(tenantId).filter((o) => o.outletId === outletId).reduce((n, o) => n + o.kots.length, 0) + 1;
    },
    async listPendingKots(tenantId, outletId) {
      return mine(tenantId)
        .filter((o) => o.outletId === outletId)
        .flatMap((o) => o.kots.filter((k) => !k.doneAt).map((k) => view(o, k.id)!))
        .sort((a, b) => a.firedAt.localeCompare(b.firedAt));
    },
    async kotById(tenantId, kotId) {
      for (const o of mine(tenantId)) {
        const v = view(o, kotId);
        if (v) return v;
      }
      return null;
    },
    async markKotDone(tenantId, kotId) {
      for (const o of mine(tenantId)) {
        const k = o.kots.find((x) => x.id === kotId);
        if (!k) continue;
        k.doneAt ??= new Date().toISOString();
        return view(o, kotId);
      }
      return null;
    },
  };
};
