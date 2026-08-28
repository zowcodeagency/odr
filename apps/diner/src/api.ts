/*
 * Public API client + the pure helpers around it (hash parsing, money).
 *
 * Only the three frozen public routes from spec section A are used — no
 * auth, no payment, CORS is open on the API side.
 */

// Dev: API on :3000 (CORS open). Deployed: same-origin, the host proxies /public/*.
const BASE =
  typeof location !== "undefined" && location.hostname !== "localhost" ? "" : "http://localhost:3000";

export type MenuItem = {
  id: string;
  name: string;
  // The API sends minor units as a string (bigint-safe) and price as major.
  price?: string | number | null;
  priceMinor?: string | number | null;
  isVeg?: boolean | null;
  description?: string | null;
};

export type Category = { id: string; name: string; items: MenuItem[] };
export type Menu = { outlet: { name: string }; categories: Category[] };

export type PlacedOrder = { orderId: string; code: string };

export type OrderStatus = {
  status: string;
  tableLabel: string;
  totalMinor: number | string;
  lines: { itemName: string; qty: number }[];
};

/** QR context: everything the app needs, from the URL or sessionStorage. */
export type Ctx = { outletId: string; label: string; token: string };

const CTX_KEY = "odr.diner.ctx";

/** `#/o/:outletId/t/:label?k=token` → Ctx. Null when the hash isn't ours. */
export function parseHash(hash: string): Ctx | null {
  const m = /^#\/o\/([^/?#]+)\/t\/([^?#]+)(?:\?(.*))?$/.exec(hash);
  if (!m) return null;
  const token = new URLSearchParams(m[3] ?? "").get("k");
  if (!token) return null;
  return {
    outletId: decodeURIComponent(m[1]!),
    label: decodeURIComponent(m[2]!),
    token,
  };
}

/**
 * Hash wins; sessionStorage is the fallback so a refresh mid-order (or a tap
 * on a link that drops the hash) keeps the diner where they were.
 */
export function loadCtx(): Ctx | null {
  const fromHash = parseHash(location.hash);
  if (fromHash) {
    sessionStorage.setItem(CTX_KEY, JSON.stringify(fromHash));
    return fromHash;
  }
  try {
    const raw = sessionStorage.getItem(CTX_KEY);
    const p = raw ? (JSON.parse(raw) as Partial<Ctx>) : null;
    return p?.outletId && p.label && p.token ? (p as Ctx) : null;
  } catch {
    return null;
  }
}

/** Rupee minor units for an item, whichever shape the API sent. */
export function minorOf(item: Pick<MenuItem, "price" | "priceMinor">): number {
  const exact = toMinor(item.priceMinor);
  if (exact !== null) return exact;
  const n = Number.parseFloat(String(item.price ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Minor units arrive as a number or a (bigint-safe) string. Null if neither. */
export function toMinor(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const whole = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const paise = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 12000 → "₹120", 12550 → "₹125.50". Paise shown only when there are paise. */
export function rupees(minor: number): string {
  const m = Math.round(minor);
  return `₹${(m % 100 === 0 ? whole : paise).format(m / 100)}`;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  menu: (c: Ctx) =>
    get<Menu>(
      `/public/outlets/${encodeURIComponent(c.outletId)}/menu?token=${encodeURIComponent(c.token)}`,
    ),

  order: (c: Ctx, id: string) =>
    get<OrderStatus>(
      `/public/orders/${encodeURIComponent(id)}?token=${encodeURIComponent(c.token)}`,
    ),

  place: async (
    c: Ctx,
    body: { customerName?: string; lines: { itemId: string; qty: number; note?: string }[] },
  ): Promise<PlacedOrder> => {
    const res = await fetch(
      `${BASE}/public/outlets/${encodeURIComponent(c.outletId)}/orders`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Prices are resolved server-side — we deliberately send none.
        body: JSON.stringify({ token: c.token, tableLabel: c.label, ...body }),
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as PlacedOrder;
  },
};

export type Step = 0 | 1 | 2;

/**
 * Domain state → the three things a diner cares about.
 * open/items_added = placed, kot_fired = cooking, settled = done.
 */
export function stepOf(status: string): Step {
  if (status === "settled" || status === "served") return 2;
  if (status === "kot_fired") return 1;
  return 0;
}

export const STEPS = ["Placed", "In the kitchen", "Served"] as const;
