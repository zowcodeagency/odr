/*
 * The signed-in shift, persisted in localStorage so a reload (or the phone
 * locking mid-service) doesn't cost the captain their session.
 *
 * `odr.token` is kept as its own key — lib/api.ts reads it directly.
 */

export interface Session {
  token: string;
  /** Own user id — used to stop an owner removing their own login. */
  userId: string;
  email: string;
  role: string;
  outletId: string;
  outletName: string;
  outletGstin?: string | null;
  outletAddress?: string;
  /** 58 or 80 — drives the thermal print CSS. */
  paperWidth: number;
  printerIp?: string | null;
  printerPort?: number;
  /** ISO date, or null when the tenant has no enforced window. */
  subscriptionEndsAt: string | null;
}

const KEY = "odr.session";

export const getSession = (): Session | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s.token ? s : null;
  } catch {
    return null;
  }
};

export const setSession = (s: Session): void => {
  localStorage.setItem(KEY, JSON.stringify(s));
  localStorage.setItem("odr.token", s.token);
};

export const patchSession = (patch: Partial<Session>): void => {
  const s = getSession();
  if (s) setSession({ ...s, ...patch });
};

export const clearSession = (): void => {
  localStorage.removeItem(KEY);
  localStorage.removeItem("odr.token");
};

export const canManage = (role: string): boolean =>
  role === "owner" || role === "manager";

/** Mirrors the API's billing:read — a captain has no business in the takings. */
export const canSeeSales = (role: string): boolean =>
  role === "owner" || role === "manager" || role === "cashier";

/**
 * Subscriptions are 'YYYY-MM-DD' with day granularity and the end date is
 * inclusive — same rule as the API's isExpired, so the lock screen and the
 * 403 flip on the same day instead of the UI locking a day early.
 */
export const isExpired = (endsAt: string | null): boolean =>
  endsAt !== null && endsAt.slice(0, 10) < new Date().toISOString().slice(0, 10);

/** Whole days until the subscription ends; null when unenforced. */
export const daysRemaining = (endsAt: string | null): number | null =>
  endsAt === null
    ? null
    : Math.round(
        (Date.parse(`${endsAt.slice(0, 10)}T00:00:00Z`) -
          Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) /
          86_400_000,
      );

export const formatEndDate = (endsAt: string): string =>
  new Date(endsAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const addressLine = (a: {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
} = {}): string =>
  [a.line1, a.line2, a.city, a.state, a.pincode].filter((p) => p && p !== "-").join(", ");
