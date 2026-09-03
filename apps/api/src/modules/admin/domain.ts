import { ValidationError } from "@odr/shared";

// Dates are plain 'YYYY-MM-DD' strings end to end — that's how postgres `date`
// comes back through drizzle, and day granularity is all a subscription needs.
// ponytail: "today" is UTC, so an IST tenant flips at 05:30 local. Swap in a
// tenant-timezone lookup if that half-day ever matters.
export const todayISO = (): string => new Date().toISOString().slice(0, 10);

/** Calendar-month add, clamped to the target month's last day (Jan 31 + 1 = Feb 28/29). */
export const addMonths = (iso: string, months: number): string => {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
};

/** New end date after a top-up: expired (or never set) resumes from today, active stacks. */
export const extendSubscription = (currentEnd: string | null, monthsAdded: number, today = todayISO()): string =>
  addMonths(currentEnd && currentEnd > today ? currentEnd : today, monthsAdded);

/** A null end date means "not enforced". End === today is still valid. */
export const isExpired = (end: string | null, today = todayISO()): boolean => end !== null && end < today;

export type SubscriptionStatus = "active" | "expiring" | "expired" | "none";

export const subscriptionStatus = (
  end: string | null,
  today = todayISO(),
): { status: SubscriptionStatus; daysRemaining: number | null } => {
  if (!end) return { status: "none", daysRemaining: null };
  const daysRemaining = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return {
    status: daysRemaining < 0 ? "expired" : daysRemaining <= 7 ? "expiring" : "active",
    daysRemaining,
  };
};

export const slugify = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "restaurant";

/** Up to 3 initials, for the outlet's invoice prefix. */
export const invoicePrefixFor = (name: string): string =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]!).join("").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "INV";

/** Outlet code: upper-case slug, ≤16 chars (the outlets.code column is what bills and QR sheets show). */
export const outletCodeFor = (name: string): string => {
  if (!name.trim()) return "OUTLET";
  return slugify(name).toUpperCase().slice(0, 16).replace(/-$/, "");
};

// ---------------------------------------------------------------- menu import

export const DEFAULT_TAX_CLASS = "GST_5";

export type ImportItem = {
  name: string;
  price: string;
  taxClass: string;
  isVeg: boolean;
  description?: string;
};
export type ImportCategory = { name: string; items: ImportItem[] };

/** Rupees in (string or number) → the decimal string the menu service expects. */
const toPrice = (v: string | number): string => {
  const s = typeof v === "number" ? v.toFixed(2) : v.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new ValidationError(`invalid price: ${v}`, { price: v });
  return s;
};

const toBool = (v: string | boolean | undefined, fallback: boolean): boolean => {
  if (typeof v === "boolean") return v;
  const s = v?.trim().toLowerCase();
  if (!s) return fallback;
  if (["true", "1", "yes", "y", "veg"].includes(s)) return true;
  if (["false", "0", "no", "n", "nonveg", "non-veg"].includes(s)) return false;
  return fallback;
};

export type JsonMenu = {
  name: string;
  items: { name: string; price: string | number; taxClass?: string; isVeg?: boolean; description?: string }[];
}[];

export const parseJsonMenu = (categories: JsonMenu): ImportCategory[] =>
  categories.map((c) => ({
    name: c.name.trim(),
    items: c.items.map((i) => ({
      name: i.name.trim(),
      price: toPrice(i.price),
      taxClass: i.taxClass?.trim() || DEFAULT_TAX_CLASS,
      isVeg: i.isVeg ?? true,
      description: i.description?.trim() || undefined,
    })),
  }));

/** Splits one CSV row, honouring "quoted, fields" and doubled "" escapes. */
const splitCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch !== '"') cur += ch;
      else if (line[i + 1] === '"') (cur += '"'), i++;
      else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") (out.push(cur), (cur = ""));
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
};

/** Header: category,name,price[,taxClass][,isVeg][,description]. Rows group by category, order preserved. */
export const parseCsvMenu = (csv: string): ImportCategory[] => {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = splitCsvLine(lines.shift() ?? "").map((h) => h.toLowerCase());
  for (const required of ["category", "name", "price"]) {
    if (!header.includes(required)) throw new ValidationError(`csv header missing "${required}"`, { header });
  }
  const at = (row: string[], col: string) => {
    const i = header.indexOf(col);
    return i === -1 ? undefined : row[i];
  };

  const byName = new Map<string, ImportCategory>();
  for (const line of lines) {
    const row = splitCsvLine(line);
    const category = at(row, "category")?.trim();
    const name = at(row, "name")?.trim();
    if (!category || !name) throw new ValidationError("csv row missing category or name", { row });
    let cat = byName.get(category);
    if (!cat) byName.set(category, (cat = { name: category, items: [] }));
    cat.items.push({
      name,
      price: toPrice(at(row, "price") ?? ""),
      taxClass: at(row, "taxclass")?.trim() || DEFAULT_TAX_CLASS,
      isVeg: toBool(at(row, "isveg"), true),
      description: at(row, "description")?.trim() || undefined,
    });
  }
  return [...byName.values()];
};
