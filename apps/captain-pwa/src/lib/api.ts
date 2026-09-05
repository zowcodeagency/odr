/*
 * Typed fetch wrapper + every endpoint the captain surface uses.
 *
 * Same-origin paths — the PWA dev server proxies /auth/* and /api/* to the
 * API (see src/server.ts), so there is no CORS list to keep in sync.
 */

import { clearSession } from "./session.ts";
import type { Branding } from "./branding.ts";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The API speaks two error shapes: `{error:{code,message}}` from the domain
 * error handler and a bare `{error:"NO_PRINTER"}` from the print routes.
 */
const errorField = (body: unknown): string | { code?: string; message?: string } | undefined =>
  typeof body === "object" && body !== null && "error" in body
    ? (body as { error: string | { code?: string; message?: string } }).error
    : undefined;

export const errorCode = (e: unknown): string | undefined => {
  if (!(e instanceof ApiError)) return undefined;
  const err = errorField(e.body);
  return typeof err === "string" ? err : err?.code;
};

const message = (status: number, body: unknown): string => {
  const err = errorField(body);
  const m = typeof err === "string" ? err : err?.message;
  // Zod issues ride in meta; name the first bad field so "invalid payload" is actionable.
  const issue = typeof err === "object" ? (err as { meta?: { issues?: { path?: (string | number)[] }[] } }).meta?.issues?.[0]?.path?.join(".") : undefined;
  return (m ?? `Request failed (${status})`) + (issue ? ` (${issue})` : "");
};

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const token = localStorage.getItem("odr.token") ?? "";
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, "Can't reach the Odr API on :3000. Is it running?");
  }

  if (res.status === 401) {
    // Any 401 anywhere ends the shift — the token is gone or expired.
    clearSession();
    window.location.hash = "/login";
  }

  const text = await res.text();
  // Domain errors are JSON; Hono's own 404 is plain text.
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text };
  }
  if (!res.ok) throw new ApiError(res.status, message(res.status, body), body);
  return body as T;
};

const get = <T>(path: string) => request<T>(path);
const send = <T>(method: string, path: string, body?: unknown) =>
  request<T>(path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

/* ---------------------------------------------------------------- types -- */

export type Channel = "dine_in" | "parcel" | "zomato" | "swiggy" | "other" | "qr";
export type OrderState = "open" | "items_added" | "kot_fired" | "settled" | "voided";

export interface LoginOk {
  token: string;
  user: { id: string; email: string; fullName: string };
  role: string;
  subscriptionEndsAt: string | null;
}
export interface LoginNeedsTenant {
  requiresTenant: true;
  tenants: { id: string; name: string }[];
}
export type LoginResult = LoginOk | LoginNeedsTenant;
export const needsTenant = (r: LoginResult): r is LoginNeedsTenant =>
  "requiresTenant" in r;

export interface Outlet {
  id: string;
  name: string;
  code: string;
  gstin?: string | null;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  invoicePrefix?: string;
  paperWidth?: number;
  printerIp?: string | null;
  printerPort?: number;
  upiId?: string | null;
  isActive: boolean;
  menuMode: "shared" | "own";
}

export interface MenuCategory {
  id: string;
  name: string;
  sortOrder?: number;
}
export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  /** Decimal string from the API, e.g. "120.00". */
  basePrice: string;
  taxClass: string;
  isVeg: boolean;
  isActive?: boolean;
  /** Bytes live at /public/menu-images/:id — list JSON only carries the flag. */
  hasImage?: boolean;
  soldOutHere?: boolean;
}

/** Dish photo payload: base64 (no data-URL prefix) + mime; null removes it. */
export interface ItemImage {
  data: string;
  type: string;
}

export interface OrderLine {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  unitPriceMinor: string;
  taxClass: string;
  note?: string | null;
  modifiers: { id: string; name: string; priceDeltaMinor: string }[];
}

export interface Order {
  id: string;
  outletId: string;
  tableLabel: string;
  channel?: Channel;
  customerName?: string | null;
  aggregatorRef?: string | null;
  state: OrderState;
  lines: OrderLine[];
  openedAt: string;
  kotFiredAt?: string;
  settledAt?: string;
}

/** Row shape of GET /ordering/orders?open=true, normalized across API versions. */
export interface OpenOrder {
  id: string;
  tableLabel: string;
  channel: Channel;
  customerName?: string | null;
  aggregatorRef?: string | null;
  status: OrderState;
  totalMinor: string;
  lineCount: number;
  createdAt: string;
}

export interface Kot {
  id: string;
  orderId: string;
  number: string;
  tableLabel: string | null;
  channel?: Channel;
  firedAt: string;
  lines: { itemName: string; qty: number; note?: string | null }[];
}

export interface Bill {
  id: string;
  outletId: string;
  orderId: string;
  invoiceNumber: string;
  fiscalYear: string;
  currency: "INR" | "SAR" | "AED" | "USD";
  subtotalMinor: string;
  taxTotalMinor: string;
  grandTotalMinor: string;
  taxBreakdown: { name: string; rate: number; amountMinor: string }[];
  customerName: string | null;
  customerPhone: string | null;
  /** Copied from the order at settle; missing on bills from older API builds. */
  channel?: Channel;
  settledAt: string;
  /** Present on newer API builds and device bills; older bills fetch the order for it. */
  tableLabel?: string | null;
  lines: {
    itemName: string;
    qty: number;
    unitPriceMinor: string;
    lineSubtotalMinor: string;
  }[];
}

export interface BillSummary {
  id: string;
  outletId: string;
  orderId: string;
  invoiceNumber: string;
  currency: "INR" | "SAR" | "AED" | "USD";
  grandTotalMinor: string;
  customerName: string | null;
  customerPhone: string | null;
  channel?: Channel;
  settledAt: string;
}

/** Range totals from GET /billing/bills/summary — every bill, not just the listed ones. */
export interface SalesSummary {
  count: number;
  subtotalMinor: string;
  taxTotalMinor: string;
  grandTotalMinor: string;
  byChannel: { channel: string; count: number; grandTotalMinor: string }[];
  taxBreakdown: { name: string; rate: number; amountMinor: string }[];
}

export interface Staff {
  id: string;
  email: string;
  fullName: string;
  role: string;
  outletId: string | null;
  outletName: string | null;
}

export interface Table {
  id: string;
  label: string;
}

/* ------------------------------------------------------------- helpers -- */

/** "120.50" → "12050". String math — money never touches a float (§14 #1). */
export const decimalToMinor = (decimal: string): string => {
  const [whole = "0", frac = ""] = decimal.trim().split(".");
  return String(BigInt(whole || "0") * 100n + BigInt(`${frac}00`.slice(0, 2)));
};

const lineTotal = (l: OrderLine): bigint =>
  (BigInt(l.unitPriceMinor) +
    l.modifiers.reduce<bigint>((a, m) => a + BigInt(m.priceDeltaMinor), 0n)) *
  BigInt(l.qty);

export const orderTotalMinor = (o: Order): bigint =>
  o.lines.reduce<bigint>((a, l) => a + lineTotal(l), 0n);

/**
 * The list endpoint gained a slim projection in the go-live spec; older API
 * builds return whole Order rows. Accept both so the floor never goes blank.
 */
const toOpenOrder = (raw: Partial<OpenOrder> & Partial<Order>): OpenOrder => ({
  id: raw.id ?? "",
  tableLabel: raw.tableLabel ?? "",
  channel: raw.channel ?? "dine_in",
  customerName: raw.customerName ?? null,
  aggregatorRef: raw.aggregatorRef ?? null,
  status: raw.status ?? raw.state ?? "open",
  totalMinor:
    raw.totalMinor ?? (raw.lines ? String(orderTotalMinor(raw as Order)) : "0"),
  lineCount: raw.lineCount ?? raw.lines?.length ?? 0,
  createdAt: raw.createdAt ?? raw.openedAt ?? new Date().toISOString(),
});

const rangeQuery = (outletId: string | null, from?: string, to?: string) =>
  [
    outletId ? `outletId=${outletId}` : "",
    from ? `from=${encodeURIComponent(from)}` : "",
    to ? `to=${encodeURIComponent(to)}` : "",
  ].filter(Boolean).join("&");

/* ----------------------------------------------------------- endpoints -- */

export const api = {
  login: (email: string, password: string, tenantId?: string) =>
    send<LoginResult>("POST", "/auth/login", { email, password, ...(tenantId ? { tenantId } : {}) }),

  /** Only called when config().offline is true — the cloud serves index.html (200) for
   *  /setup, not a 404, so login.tsx never calls this there. The 404 fallback stays
   *  as a second line of defense. */
  setupStatus: () =>
    get<{ needed: boolean }>("/setup").catch((e: unknown) =>
      e instanceof ApiError && e.status === 404 ? { needed: false } : Promise.reject(e),
    ),
  setup: (input: { name: string; ownerEmail: string; ownerPassword: string; ownerFullName: string; gstin?: string }) =>
    send<{ tenantId: string; outletId: string }>("POST", "/setup", input),

  me: () =>
    get<{
      userId: string;
      tenantId: string;
      role: string;
      subscriptionEndsAt: string | null;
      localBilling?: boolean;
      taxCountry?: string;
    }>("/api/v1/me"),

  branding: () => get<{ branding: Branding | null }>("/api/v1/branding").then((r) => r.branding),
  saveBranding: (b: Branding) =>
    send<{ branding: Branding }>("PUT", "/api/v1/branding", b).then((r) => r.branding),
  resetBranding: () => send<null>("DELETE", "/api/v1/branding"),

  outlets: () => get<{ outlets: Outlet[] }>("/api/v1/outlets").then((r) => r.outlets),
  patchOutlet: (
    id: string,
    patch: {
      paperWidth?: number;
      printerIp?: string | null;
      printerPort?: number;
      name?: string;
      gstin?: string | null;
      address?: { line1: string; line2?: string; city: string; state: string; pincode: string; country: string };
      invoicePrefix?: string;
      upiId?: string | null;
    },
  ) => send<{ outlet: Outlet }>("PATCH", `/api/v1/outlets/${id}`, patch).then((r) => r.outlet),
  qrToken: (outletId: string) =>
    send<{ publicToken: string }>("POST", `/api/v1/outlets/${outletId}/qr-token`, {}),

  tables: (outletId: string) =>
    get<{ tables: Table[] }>(`/api/v1/outlets/${outletId}/tables`).then((r) => r.tables),
  addTables: (outletId: string, labels: string[]) =>
    send<{ tables: Table[] }>("POST", `/api/v1/outlets/${outletId}/tables`, { labels }),
  deleteTable: (id: string) => send<null>("DELETE", `/api/v1/tables/${id}`),

  staff: () => get<{ staff: Staff[] }>("/api/v1/staff").then((r) => r.staff),
  addStaff: (input: { email: string; password: string; fullName: string; role: string; outletId?: string }) =>
    send<{ staff: Staff }>("POST", "/api/v1/staff", input),
  removeStaff: (id: string) => send<null>("DELETE", `/api/v1/staff/${id}`),

  categories: (outletId: string) =>
    get<{ categories: MenuCategory[] }>(
      `/api/v1/menu/categories?outletId=${outletId}`,
    ).then((r) => r.categories),
  /** Sold-out dishes are hidden by default; the menu editor asks for them. */
  items: (outletId: string, includeInactive = false) =>
    get<{ items: MenuItem[] }>(`/api/v1/menu/items?outletId=${outletId}`).then((r) =>
      includeInactive ? r.items : r.items.filter((i) => i.isActive !== false),
    ),

  createCategory: (outletId: string, name: string) =>
    send<{ category: MenuCategory }>("POST", "/api/v1/menu/categories", { name, outletId }),
  renameCategory: (id: string, name: string) =>
    send<{ category: MenuCategory }>("PATCH", `/api/v1/menu/categories/${id}`, { name }),
  deleteCategory: (id: string) => send<null>("DELETE", `/api/v1/menu/categories/${id}`),

  createMenuItem: (input: {
    outletId?: string;
    categoryId: string;
    name: string;
    description?: string;
    basePrice: string;
    taxClass: string;
    isVeg: boolean;
    image?: ItemImage | null;
  }) => send<{ item: MenuItem }>("POST", "/api/v1/menu/items", input),
  updateMenuItem: (
    id: string,
    patch: {
      name?: string;
      description?: string | null;
      basePrice?: string;
      taxClass?: string;
      isVeg?: boolean;
      isActive?: boolean;
      image?: ItemImage | null;
    },
  ) => send<{ item: MenuItem }>("PATCH", `/api/v1/menu/items/${id}`, patch),
  deleteMenuItem: (id: string) => send<null>("DELETE", `/api/v1/menu/items/${id}`),
  /** The daily 86 — sold out at this outlet only. */
  setSoldOut: (itemId: string, outletId: string, soldOut: boolean) =>
    send<{ item: MenuItem }>("PUT", `/api/v1/menu/items/${itemId}/soldout`, { outletId, soldOut }).then((r) => r.item),

  openOrders: (outletId: string) =>
    get<{ orders: (Partial<OpenOrder> & Partial<Order>)[] }>(
      `/api/v1/ordering/orders?outletId=${outletId}&open=true`,
    ).then((r) => r.orders.map(toOpenOrder)),

  createOrder: (input: {
    outletId: string;
    tableLabel?: string;
    channel?: Channel;
    customerName?: string;
    aggregatorRef?: string;
  }) => send<{ order: Order }>("POST", "/api/v1/ordering/orders", input).then((r) => r.order),

  order: (id: string) =>
    get<{ order: Order }>(`/api/v1/ordering/orders/${id}`).then((r) => r.order),

  addItems: (
    id: string,
    lines: {
      itemId: string;
      itemName: string;
      qty: number;
      unitPriceMinor: string;
      taxClass: string;
      note?: string;
      modifiers: { id: string; name: string; priceDeltaMinor: string }[];
    }[],
  ) =>
    send<{ order: Order }>("POST", `/api/v1/ordering/orders/${id}/items`, { lines }).then(
      (r) => r.order,
    ),

  fireKot: (id: string) =>
    send<{ order: Order }>("POST", `/api/v1/ordering/orders/${id}/fire-kot`).then((r) => r.order),
  /** `localBill` tells the cloud this device keeps the invoice — no auto-bill. */
  settleOrder: (id: string, localBill = false) =>
    send<{ order: Order }>("POST", `/api/v1/ordering/orders/${id}/settle`, localBill ? { localBill } : undefined).then((r) => r.order),
  /** Cloud deletes the settled order with its lines and KOTs — the device holds the bill. */
  forgetOrder: (id: string) => send<null>("DELETE", `/api/v1/ordering/orders/${id}`),
  voidOrder: (id: string) =>
    send<{ order: Order }>("POST", `/api/v1/ordering/orders/${id}/void`).then((r) => r.order),

  kots: (outletId: string) =>
    get<{ kots: Kot[] }>(`/api/v1/ordering/kots?outletId=${outletId}&pending=true`).then(
      (r) => r.kots,
    ),
  bumpKot: (id: string) => send<null>("POST", `/api/v1/ordering/kots/${id}/done`),

  createBill: (orderId: string, customer?: { customerName?: string; customerPhone?: string }) =>
    send<{ bill: Bill }>("POST", "/api/v1/billing/bills", { orderId, ...customer }).then((r) => r.bill),
  /** null outlet = every outlet the login may see (owner / manager). Newest first, at most 500. */
  bills: (outletId: string | null, from?: string, to?: string) =>
    get<{ bills: BillSummary[] }>(`/api/v1/billing/bills?${rangeQuery(outletId, from, to)}&limit=500`).then((r) => r.bills),
  billsSummary: (outletId: string | null, from?: string, to?: string) =>
    get<{ summary: SalesSummary }>(`/api/v1/billing/bills/summary?${rangeQuery(outletId, from, to)}`).then((r) => r.summary),
  bill: (id: string) => get<{ bill: Bill }>(`/api/v1/billing/bills/${id}`).then((r) => r.bill),

  printKot: (id: string) => send<null>("POST", `/api/v1/print/kots/${id}`),
  printBill: (id: string) => send<null>("POST", `/api/v1/print/bills/${id}`),
  // ponytail: the frozen contract only prints real documents; a dedicated
  // /print/test keeps "does the printer answer?" out of the order flow.
  printTest: (outletId: string) => send<null>("POST", `/api/v1/print/test`, { outletId }),
};
