/*
 * UI-only money formatting.
 *
 * The API serializes bigint minor units as **strings** (see
 * apps/api/src/modules/billing/routes.ts). This helper consumes that shape and
 * never `parseFloat`s it — the brief §14 rule #1.
 */

export type Currency = "INR" | "SAR" | "AED" | "USD";

const SYMBOL: Record<Currency, string> = {
  INR: "₹",
  SAR: "﷼",
  AED: "د.إ",
  USD: "$",
};

const LOCALE: Record<Currency, string> = {
  INR: "en-IN",
  SAR: "ar-SA",
  AED: "ar-AE",
  USD: "en-US",
};

const toMinor = (v: bigint | string | number): bigint => {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.round(v));
  return BigInt(v);
};

export interface FormatOptions {
  withSymbol?: boolean;
  locale?: string;
}

/**
 * Format minor units (paise/halala/cents) as a localized major-unit string.
 * Uses Intl.NumberFormat for grouping (Indian lakh/crore where applicable).
 */
export const formatMinor = (
  value: bigint | string | number,
  currency: Currency = "INR",
  opts: FormatOptions = {},
): string => {
  const minor = toMinor(value);
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const major = Number(abs / 100n);
  const fraction = Number(abs % 100n);

  const fmt = new Intl.NumberFormat(opts.locale ?? LOCALE[currency], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formatted = fmt.format(major + fraction / 100);
  const sign = negative ? "−" : "";
  return opts.withSymbol === false ? `${sign}${formatted}` : `${sign}${SYMBOL[currency]} ${formatted}`;
};

export const currencySymbol = (c: Currency): string => SYMBOL[c];
