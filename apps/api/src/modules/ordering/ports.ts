import type { Order } from "./domain.ts";

/** Read model for the kitchen display and KOT printing — flattened across orders. */
export type KotView = {
  id: string;
  orderId: string;
  number: number;
  tableLabel: string | null;
  channel: string;
  firedAt: string;
  doneAt: string | null;
  lines: Array<{ itemName: string; qty: number; note: string | null }>;
};

export interface OrderRepo {
  byId(tenantId: string, id: string): Promise<Order | null>;
  insert(order: Order): Promise<Order>;
  save(order: Order): Promise<Order>;
  listOpen(tenantId: string, outletId: string): Promise<Order[]>;
  /** Per-outlet daily KOT sequence. */
  nextKotNumber(tenantId: string, outletId: string): Promise<number>;
  listPendingKots(tenantId: string, outletId: string): Promise<KotView[]>;
  kotById(tenantId: string, kotId: string): Promise<KotView | null>;
  /** Idempotent bump — returns null when the kot doesn't exist. */
  markKotDone(tenantId: string, kotId: string): Promise<KotView | null>;
  /** Removes the order with its lines and KOTs. Used when the device keeps the bill. */
  delete(tenantId: string, id: string): Promise<void>;
}
