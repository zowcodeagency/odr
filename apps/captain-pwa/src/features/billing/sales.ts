/*
 * Sales report helpers. The cloud sums its bills in SQL; bills kept on this
 * device are summed here and added on, so the screen shows one set of totals.
 */
import type { Bill, SalesSummary } from "../../lib/api.ts";

export const EMPTY_SUMMARY: SalesSummary = {
  count: 0, subtotalMinor: "0", taxTotalMinor: "0", grandTotalMinor: "0", byChannel: [], taxBreakdown: [],
};

/** Same buckets the cloud's summary query produces: per channel, per (tax component, rate). */
export const summarize = (bills: Bill[]): SalesSummary => {
  const channels = new Map<string, { count: number; grand: bigint }>();
  const taxes = new Map<string, { name: string; rate: number; amount: bigint }>();
  let subtotal = 0n, tax = 0n, grand = 0n;
  for (const b of bills) {
    subtotal += BigInt(b.subtotalMinor);
    tax += BigInt(b.taxTotalMinor);
    grand += BigInt(b.grandTotalMinor);
    const ch = b.channel ?? "dine_in";
    const c = channels.get(ch) ?? { count: 0, grand: 0n };
    channels.set(ch, { count: c.count + 1, grand: c.grand + BigInt(b.grandTotalMinor) });
    for (const t of b.taxBreakdown) {
      const key = `${t.name}@${t.rate}`;
      const prev = taxes.get(key);
      taxes.set(key, { name: t.name, rate: t.rate, amount: (prev?.amount ?? 0n) + BigInt(t.amountMinor) });
    }
  }
  return {
    count: bills.length,
    subtotalMinor: String(subtotal),
    taxTotalMinor: String(tax),
    grandTotalMinor: String(grand),
    byChannel: [...channels].map(([channel, c]) => ({ channel, count: c.count, grandTotalMinor: String(c.grand) })),
    taxBreakdown: [...taxes.values()].map((t) => ({ name: t.name, rate: t.rate, amountMinor: String(t.amount) })),
  };
};

/** Cloud + device. Rows with the same channel or the same (component, rate) merge. */
export const addSummaries = (a: SalesSummary, b: SalesSummary): SalesSummary => {
  const add = (x: string, y: string) => String(BigInt(x) + BigInt(y));
  const channels = new Map(a.byChannel.map((c) => [c.channel, { ...c }]));
  for (const c of b.byChannel) {
    const prev = channels.get(c.channel);
    channels.set(c.channel, prev
      ? { channel: c.channel, count: prev.count + c.count, grandTotalMinor: add(prev.grandTotalMinor, c.grandTotalMinor) }
      : { ...c });
  }
  const taxes = new Map(a.taxBreakdown.map((t) => [`${t.name}@${t.rate}`, { ...t }]));
  for (const t of b.taxBreakdown) {
    const key = `${t.name}@${t.rate}`;
    const prev = taxes.get(key);
    taxes.set(key, prev ? { ...prev, amountMinor: add(prev.amountMinor, t.amountMinor) } : { ...t });
  }
  return {
    count: a.count + b.count,
    subtotalMinor: add(a.subtotalMinor, b.subtotalMinor),
    taxTotalMinor: add(a.taxTotalMinor, b.taxTotalMinor),
    grandTotalMinor: add(a.grandTotalMinor, b.grandTotalMinor),
    byChannel: [...channels.values()].sort((x, y) => (BigInt(x.grandTotalMinor) < BigInt(y.grandTotalMinor) ? 1 : -1)),
    taxBreakdown: [...taxes.values()].sort((x, y) => x.name.localeCompare(y.name) || x.rate - y.rate),
  };
};

/* ------------------------------------------------------------ date range -- */

export type Preset = "today" | "yesterday" | "week" | "month" | "custom";
export const PRESETS: [Preset, string][] = [
  ["today", "Today"], ["yesterday", "Yesterday"], ["week", "This week"], ["month", "This month"], ["custom", "Pick dates"],
];

/** Local calendar day as YYYY-MM-DD — what <input type="date"> speaks. */
export const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const shift = (d: Date, days: number) => { const n = new Date(d); n.setDate(n.getDate() + days); return n; };

/** First and last calendar day of a preset, in the restaurant's own clock. */
export const presetDays = (preset: Exclude<Preset, "custom">, now = new Date()): { from: string; to: string } => {
  const today = ymd(now);
  if (preset === "today") return { from: today, to: today };
  if (preset === "yesterday") { const y = ymd(shift(now, -1)); return { from: y, to: y }; }
  if (preset === "week") return { from: ymd(shift(now, -((now.getDay() + 6) % 7))), to: today }; // Monday
  return { from: `${today.slice(0, 8)}01`, to: today };
};

/** Inclusive day range → ISO instants for the API: local midnight to the last millisecond of `to`. */
export const dayBounds = ({ from, to }: { from: string; to: string }): { from: string; to: string } => {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: new Date(end.getTime() - 1).toISOString() };
};

/** The same number of days immediately before — "vs yesterday", "vs last week". */
export const previousDays = ({ from, to }: { from: string; to: string }): { from: string; to: string } => {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
  return { from: ymd(shift(a, -days)), to: ymd(shift(a, -1)) };
};
