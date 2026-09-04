import { ConflictError } from "@odr/shared";

export type OrderState = "open" | "items_added" | "kot_fired" | "settled" | "voided";

/** Where the order came in from. dine_in is the only channel that needs a table. */
export const ORDER_CHANNELS = ["dine_in", "parcel", "zomato", "swiggy", "other", "qr"] as const;
export type OrderChannel = (typeof ORDER_CHANNELS)[number];

export type OrderLine = {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  unitPriceMinor: bigint;
  taxClass: string;
  note?: string;
  modifiers: Array<{ id: string; name: string; priceDeltaMinor: bigint }>;
};

/** One kitchen ticket. lineIds are the order lines it was fired with. */
export type Kot = {
  id: string;
  number: number;
  firedAt: string;
  doneAt?: string;
  lineIds: string[];
};

export type Order = {
  id: string;
  tenantId: string;
  outletId: string;
  tableLabel: string | null;
  channel: OrderChannel;
  customerName?: string | null;
  aggregatorRef?: string | null;
  state: OrderState;
  lines: OrderLine[];
  kots: Kot[];
  openedAt: string;
  kotFiredAt?: string;
  settledAt?: string;
};

const allowed: Record<OrderState, ReadonlySet<OrderState>> = {
  open:         new Set<OrderState>(["items_added", "voided"]),
  items_added:  new Set<OrderState>(["items_added", "kot_fired", "voided"]),
  // A fired table keeps ordering — another round, an extra roti, a parcel on
  // the way out. Re-firing only sends the lines that were not fired before.
  kot_fired:    new Set<OrderState>(["items_added", "kot_fired", "settled", "voided"]),
  settled:      new Set<OrderState>([]),
  voided:       new Set<OrderState>([]),
};

export const assertTransition = (from: OrderState, to: OrderState): void => {
  if (!allowed[from].has(to)) {
    throw new ConflictError(`illegal transition ${from} → ${to}`, { from, to });
  }
};

export const OPEN_STATES: OrderState[] = ["open", "items_added", "kot_fired"];
export const isOpenState = (s: OrderState): boolean => OPEN_STATES.includes(s);

/** dine_in must sit at a table; every other channel is off-table. */
export const requiresTable = (channel: OrderChannel): boolean => channel === "dine_in";

/** Short human code shown to diners — last 6 of the uuid, uppercased. */
export const orderCode = (orderId: string): string => orderId.replace(/-/g, "").slice(-6).toUpperCase();

/** Pre-tax total of an order, in minor units. Tax lands at billing time. */
export const orderTotalMinor = (lines: OrderLine[]): bigint =>
  lines.reduce(
    (sum, l) =>
      sum +
      BigInt(l.qty) * (l.unitPriceMinor + l.modifiers.reduce((m, x) => m + x.priceDeltaMinor, 0n)),
    0n,
  );
