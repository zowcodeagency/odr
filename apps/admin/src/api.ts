/*
 * Thin fetch wrapper for the admin API (spec section A).
 *
 * Direct calls to the API origin — the backend enables CORS for :3002, so
 * there is no proxy to keep in sync.
 */

// Dev: API on :3000 (CORS open for :3002). Deployed: same-origin, the host proxies /admin/*.
const BASE =
  typeof location !== "undefined" && location.hostname !== "localhost" ? "" : "http://localhost:3000";
export const KEY_STORAGE = "odr.adminKey";

// Team sign-in goes through Supabase Auth; accounts are created by hand in
// the Supabase dashboard. The anon key is publishable by design.
const SUPABASE_URL = "https://vgtrqvsicskebnqyzwfd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndHJxdnNpY3NrZWJucXl6d2ZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4OTQwOTIsImV4cCI6MjA5MzQ3MDA5Mn0.PPwMEkd17Rjkr6WDj4DI2x-xOMkFXClYrU8EpZNoaG8";

/** Sign in a team member; resolves to the access token the API accepts as Bearer. */
async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new ApiError("Wrong email or password.", 401);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new ApiError("Wrong email or password.", 401);
  return data.access_token;
}

export type Status = "active" | "expiring" | "expired" | "none";

export type Restaurant = {
  // The list rows are keyed by tenant; accept either name the API uses.
  id?: string;
  tenantId?: string;
  name: string;
  subscriptionEnd: string | null;
  daysRemaining: number | null;
  status: Status;
};

export type Topup = {
  id?: string;
  amount?: number | string;
  amountMinor?: number | string;
  monthsAdded: number;
  note?: string | null;
  createdAt: string;
};

export type CreatePayload = {
  name: string;
  ownerFullName: string;
  ownerEmail: string;
  ownerPassword: string;
  startDate: string;
  months: number;
  gstin?: string;
};

/** Thrown for any non-2xx response; `unauthorized` drives the gate reset. */
export class ApiError extends Error {
  unauthorized: boolean;
  constructor(message: string, status: number) {
    super(message);
    this.unauthorized = status === 401;
  }
}

export const tenantId = (r: Restaurant): string => r.tenantId ?? r.id ?? "";

// The API sends either a flat string or { code, message } — show the message,
// never "[object Object]".
const stringifyError = (e: unknown): string =>
  typeof e === "string"
    ? e
    : e && typeof e === "object" && "message" in e
      ? String((e as { message: unknown }).message)
      : "";

async function call<T>(key: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/admin${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        authorization: `Bearer ${key}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(
      "Can't reach the Odr API at localhost:3000. Is it running?",
      0,
    );
  }

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const detail =
      (parsed && typeof parsed === "object" && "error" in parsed
        ? stringifyError((parsed as { error: unknown }).error)
        : "") || `Request failed (${res.status})`;
    throw new ApiError(
      res.status === 401 ? "That access key was rejected." : detail,
      res.status,
    );
  }
  return parsed as T;
}

export const api = {
  signIn,
  list: (key: string) =>
    call<{ restaurants: Restaurant[] }>(key, "/restaurants").then((r) => r.restaurants),
  create: (key: string, p: CreatePayload) =>
    call<Record<string, string>>(key, "/restaurants", p),
  topups: (key: string, id: string) =>
    call<{ topups: Topup[] }>(key, `/restaurants/${id}/topups`).then((r) => r.topups),
  addTopup: (
    key: string,
    id: string,
    p: { amount: number; monthsAdded: number; note?: string },
  ) => call<{ subscriptionEnd: string }>(key, `/restaurants/${id}/topups`, p),
  importMenu: (key: string, id: string, payload: unknown) =>
    call<{ categories: number; items: number }>(
      key,
      `/restaurants/${id}/menu/import`,
      payload,
    ),
};
