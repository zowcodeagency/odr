import { useMemo, useState } from "react";
import { Download, HardDrive, Phone, Search } from "lucide-react";
import { Badge, Money, StatusPill, formatMinor, type OrderStatus } from "@odr/ui";
import { api, type BillSummary, type Channel, type SalesSummary } from "../lib/api.ts";
import { navigate } from "../lib/router.ts";
import { useAsync } from "../lib/use-async.ts";
import { CHANNEL_LABEL, CHANNEL_TONE, isOffTable, minutesSince } from "../features/ordering/channels.ts";
import { canManage, canSeeSales, type Session } from "../lib/session.ts";
import { localBills } from "../lib/local-db.ts";
import {
  EMPTY_SUMMARY, PRESETS, addSummaries, dayBounds, presetDays, previousDays, summarize, ymd, type Preset,
} from "../features/billing/sales.ts";

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const day = (ymdStr: string) =>
  new Date(`${ymdStr}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const pct = (rate: number) => `${+(rate * 100).toFixed(2)}%`;
const channelLabel = (c: string) => CHANNEL_LABEL[c as Channel] ?? c;

const VS: Record<Preset, string> = {
  today: "vs yesterday", yesterday: "vs the day before", week: "vs last week", month: "vs last month", custom: "vs the days before",
};

export const BillsRoute = ({ session }: { session: Session }) => {
  const [q, setQ] = useState("");
  const canAll = canManage(session.role) && session.outlets.length > 1;
  const [scope, setScope] = useState<"outlet" | "all">("outlet");
  const all = canAll && scope === "all";
  const outletId = session.outletId;

  const [preset, setPreset] = useState<Preset>("today");
  const [custom, setCustom] = useState(() => presetDays("today"));
  const days = preset === "custom" ? custom : presetDays(preset);
  const range = dayBounds(days);
  const includesToday = days.to >= ymd(new Date());

  // Totals come from the cloud's own sum over every bill in the range; the list
  // is capped at 500 and only feeds the table below. Device-kept bills are
  // added to both here, since the cloud has never seen them.
  const data = useAsync(
    async () => {
      const prev = dayBounds(previousDays(days));
      const [summary, before, cloud, open, device, perOutlet] = await Promise.all([
        api.billsSummary(all ? null : outletId, range.from, range.to),
        api.billsSummary(all ? null : outletId, prev.from, prev.to).catch(() => null),
        api.bills(all ? null : outletId, range.from, range.to),
        includesToday ? api.openOrders(outletId) : Promise.resolve([]),
        localBills.list(outletId, range.from, range.to).catch(() => []),
        all ? Promise.all(session.outlets.map((o) => api.billsSummary(o.id, range.from, range.to).catch(() => EMPTY_SUMMARY))) : Promise.resolve([]),
      ]);
      const unsynced = device.filter((b) => !b.syncedAt);
      const seen = new Set(cloud.map((b) => b.id));
      const bills: (BillSummary & { local?: boolean })[] = [
        ...cloud,
        ...unsynced.filter((b) => !seen.has(b.id)).map((b) => ({ ...b, local: true })),
      ].sort((a, b) => b.settledAt.localeCompare(a.settledAt));
      return {
        summary: addSummaries(summary, summarize(unsynced)),
        before,
        bills,
        capped: cloud.length >= 500,
        open,
        perOutlet: session.outlets.map((o, i) => ({
          ...o,
          summary: o.id === outletId ? addSummaries(perOutlet[i] ?? EMPTY_SUMMARY, summarize(unsynced)) : perOutlet[i] ?? EMPTY_SUMMARY,
        })),
      };
    },
    [outletId, all, range.from, range.to],
    15000,
  );

  const summary = data.data?.summary ?? EMPTY_SUMMARY;
  const bills = data.data?.bills ?? [];
  const open = data.data?.open ?? [];
  const openValue = open.reduce<bigint>((a, o) => a + BigInt(o.totalMinor), 0n);

  const delta = (() => {
    const b = data.data?.before;
    if (!b || b.grandTotalMinor === "0") return null;
    return Number(((BigInt(summary.grandTotalMinor) - BigInt(b.grandTotalMinor)) * 100n) / BigInt(b.grandTotalMinor));
  })();

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return bills;
    return bills.filter((b) =>
      [b.invoiceNumber, b.customerName, b.customerPhone, channelLabel(b.channel ?? "dine_in")]
        .some((f) => f?.toLowerCase().includes(needle)),
    );
  }, [bills, q]);

  const outletName = (id: string) => session.outlets.find((o) => o.id === id)?.name ?? "";
  const grand = BigInt(summary.grandTotalMinor);
  const share = (minor: string) => (grand === 0n ? 0 : Number((BigInt(minor) * 100n) / grand));

  // ponytail: the accountant's export is the same rows the screen shows — the latest 500 at most.
  const downloadCsv = () => {
    const esc = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Invoice", "Date", "Time", "Outlet", "Channel", "Customer", "Phone", "Total"],
      ...visible.map((b) => [
        b.invoiceNumber,
        new Date(b.settledAt).toLocaleDateString("en-GB"),
        time(b.settledAt),
        outletName(b.outletId),
        channelLabel(b.channel ?? "dine_in"),
        b.customerName,
        b.customerPhone,
        formatMinor(b.grandTotalMinor, b.currency, { withSymbol: false }),
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `odr-sales-${days.from}-to-${days.to}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!canSeeSales(session.role)) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-[15px] font-medium">Takings are for cashiers, managers and owners</p>
      </div>
    );
  }

  const rangeLabel = days.from === days.to ? day(days.from) : `${day(days.from)} – ${day(days.to)}`;

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-7 lg:px-10 max-w-[1100px] mx-auto">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-semibold tracking-[-0.02em]">Sales &amp; invoices</h1>
          <p className="mt-1 text-[13px] text-[var(--fg-tertiary)]">
            {all ? `All ${session.outlets.length} outlets` : session.outletName} · {rangeLabel}
            {includesToday ? " · refreshes every 15 seconds" : ""}
          </p>
        </div>
        {canAll ? (
          <Pills
            label="sales scope"
            value={scope}
            onChange={setScope}
            options={[["outlet", "This outlet"], ["all", "All outlets"]]}
          />
        ) : null}
      </header>

      {/* Which days. Presets cover the everyday questions; the two date boxes cover the rest. */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Pills label="date range" value={preset} onChange={setPreset} options={PRESETS} />
        {preset === "custom" ? (
          <div className="flex items-center gap-2 text-[13px]">
            <input
              type="date"
              value={custom.from}
              max={custom.to}
              onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))}
              className="h-10 px-3 rounded-[var(--radius-2)] bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]"
            />
            <span className="text-[var(--fg-muted)]">to</span>
            <input
              type="date"
              value={custom.to}
              min={custom.from}
              max={ymd(new Date())}
              onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))}
              className="h-10 px-3 rounded-[var(--radius-2)] bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]"
            />
          </div>
        ) : null}
      </div>

      {/* The four numbers. */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--line-default)] rounded-[var(--radius-3)] ring-1 ring-[var(--line-default)] overflow-hidden mb-6">
        <Stat
          label="Sales"
          value={<Money minor={summary.grandTotalMinor} mono />}
          hint={`${summary.count} bill${summary.count === 1 ? "" : "s"}${
            delta === null ? "" : ` · ${delta >= 0 ? "+" : ""}${delta}% ${VS[preset]}`
          }`}
        />
        <Stat
          label="Before tax"
          value={<Money minor={summary.subtotalMinor} mono />}
          hint="what the food and drink came to"
        />
        <Stat
          label="Tax collected"
          value={<Money minor={summary.taxTotalMinor} mono />}
          hint={summary.taxBreakdown.length ? [...new Set(summary.taxBreakdown.map((t) => t.name))].join(" + ") : "no tax in this range"}
        />
        <Stat
          label="Average bill"
          value={<Money minor={summary.count ? grand / BigInt(summary.count) : 0n} mono />}
          hint={includesToday && !all ? `${formatMinor(openValue, "INR")} still open on the floor` : "per invoice"}
        />
      </section>

      {/* Breakdown: where the money came from, and what part of it is tax. */}
      <section className="mb-6 grid gap-3 md:grid-cols-2">
        <Table
          title="Where the bills came from"
          empty="No bills in these days"
          rows={summary.byChannel.map((c) => ({
            key: c.channel,
            label: channelLabel(c.channel),
            note: `${c.count} bill${c.count === 1 ? "" : "s"} · ${share(c.grandTotalMinor)}%`,
            amount: c.grandTotalMinor,
          }))}
        />
        <Table
          title="Tax collected"
          empty="No tax in these days"
          rows={summary.taxBreakdown.map((t) => ({
            key: `${t.name}@${t.rate}`,
            label: `${t.name} @ ${pct(t.rate)}`,
            note: `on ${formatMinor(t.rate ? (BigInt(t.amountMinor) * 10000n) / BigInt(Math.round(t.rate * 10000)) : 0n, "INR")} of sales`,
            amount: t.amountMinor,
          }))}
          total={summary.taxBreakdown.length ? { label: "Total tax", amount: summary.taxTotalMinor } : undefined}
        />
      </section>

      {all ? (
        <section className="mb-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {(data.data?.perOutlet ?? []).map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-[var(--radius-3)] bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]">
              <span className="min-w-0">
                <span className="block text-[14px] font-medium truncate">{o.name}</span>
                <span className="block text-[12px] text-[var(--fg-tertiary)]">{o.summary.count} bill{o.summary.count === 1 ? "" : "s"}</span>
              </span>
              <Money minor={o.summary.grandTotalMinor} mono className="text-[15px] font-medium" />
            </div>
          ))}
        </section>
      ) : null}

      {/* Not done — the orders that have not turned into money yet. */}
      {!all && open.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 text-[13px] font-medium text-[var(--fg-secondary)]">
            Not settled yet · {open.length} · <Money minor={openValue} mono />
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {open.map((o) => (
              <button
                key={o.id}
                onClick={() => navigate({ name: "order", orderId: o.id })}
                className="flex items-center gap-3 min-h-[56px] px-3.5 py-2.5 text-left
                           rounded-[var(--radius-3)] bg-[var(--bg-surface)]
                           ring-1 ring-[var(--line-default)] hover:bg-[var(--bg-surface-2)]"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-medium truncate">
                    {o.tableLabel || o.customerName || o.aggregatorRef || "Walk-in"}
                  </span>
                  <span className="block text-[12px] text-[var(--fg-tertiary)]">
                    {minutesSince(o.createdAt)}m · {o.lineCount} item
                    {o.lineCount === 1 ? "" : "s"}
                  </span>
                </span>
                <Money minor={o.totalMinor} mono className="text-[14px]" />
                <StatusPill status={o.status as OrderStatus} />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Done — the invoices. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2.5">
        <h2 className="text-[13px] font-medium text-[var(--fg-secondary)]">
          Invoices · {summary.count}
          {data.data?.capped ? <span className="font-normal text-[var(--fg-muted)]"> · showing the latest 500; totals above count every bill</span> : null}
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Invoice, name, phone, channel"
              className="h-11 w-full sm:w-[230px] pl-9 pr-3 rounded-[var(--radius-2)]
                         bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]
                         text-[13px] placeholder:text-[var(--fg-muted)]
                         focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <button
            onClick={downloadCsv}
            disabled={visible.length === 0}
            title="Download these invoices as a spreadsheet"
            className="h-11 px-3 inline-flex items-center gap-1.5 rounded-[var(--radius-2)] text-[13px]
                       bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)] hover:bg-[var(--bg-surface-2)]
                       disabled:opacity-40"
          >
            <Download size={15} /> CSV
          </button>
        </div>
      </div>

      {data.loading && !data.data ? (
        <p className="text-[13px] text-[var(--fg-muted)]">Loading…</p>
      ) : data.error ? (
        <p className="text-[13px] text-[var(--status-voided)]">{data.error}</p>
      ) : visible.length === 0 ? (
        <div className="rounded-[var(--radius-3)] ring-1 ring-[var(--line-default)] bg-[var(--bg-surface)] p-8 text-center">
          <p className="text-[14px] text-[var(--fg-tertiary)]">
            {q ? `Nothing matches "${q}".` : preset === "today" ? "No bills settled yet today." : "No bills settled in these days."}
          </p>
        </div>
      ) : (
        <ul className="rounded-[var(--radius-3)] ring-1 ring-[var(--line-default)] bg-[var(--bg-surface)] overflow-hidden divide-y divide-[var(--line-subtle)]">
          {visible.map((b) => {
            const channel = b.channel ?? "dine_in";
            return (
              <li key={b.id}>
                <button
                  onClick={() => navigate({ name: "bill", billId: b.id })}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left min-h-[56px]
                             hover:bg-[var(--bg-surface-2)]"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block font-mono text-[13px] truncate">
                      {all ? `${outletName(b.outletId)} · ` : ""}{b.invoiceNumber}
                    </span>
                    <span className="block text-[12px] text-[var(--fg-tertiary)] truncate">
                      {days.from === days.to ? time(b.settledAt) : new Date(b.settledAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {b.customerName ? ` · ${b.customerName}` : ""}
                      {b.customerPhone ? ` · ${b.customerPhone}` : ""}
                    </span>
                  </span>
                  {isOffTable(channel) ? <Badge tone={CHANNEL_TONE[channel]}>{CHANNEL_LABEL[channel]}</Badge> : null}
                  {b.local ? (
                    <HardDrive size={14} className="shrink-0 text-[var(--accent)]" aria-label="On this device" />
                  ) : null}
                  {b.customerPhone ? (
                    <Phone size={14} className="shrink-0 text-[var(--accent)]" />
                  ) : null}
                  <Money
                    minor={b.grandTotalMinor}
                    currency={b.currency}
                    mono
                    className="text-[15px] font-medium"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const Pills = <K extends string>({
  label, value, onChange, options,
}: {
  label: string;
  value: K;
  onChange: (k: K) => void;
  options: readonly (readonly [K, string])[];
}) => (
  <div
    role="tablist"
    aria-label={label}
    className="flex flex-wrap p-1 gap-1 rounded-[var(--radius-pill)] bg-[var(--bg-surface-2)] ring-1 ring-[var(--line-subtle)]"
  >
    {options.map(([k, text]) => (
      <button
        key={k}
        role="tab"
        aria-selected={value === k}
        onClick={() => onChange(k)}
        className={`px-3.5 min-h-10 rounded-[var(--radius-pill)] text-[13px] transition-colors duration-[var(--dur-quick)] ${
          value === k ? "bg-[var(--bg-surface)] font-medium shadow-[var(--shadow-1)]" : "text-[var(--fg-muted)]"
        }`}
      >
        {text}
      </button>
    ))}
  </div>
);

const Stat = ({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) => (
  <div className="bg-[var(--bg-surface)] p-4 sm:p-5">
    <p className="text-[12px] text-[var(--fg-tertiary)]">{label}</p>
    <p className="mt-1.5 text-[18px] sm:text-[24px] font-semibold leading-none tracking-[-0.02em] font-mono break-words">
      {value}
    </p>
    <p className="mt-1.5 text-[12px] text-[var(--fg-muted)] truncate">{hint}</p>
  </div>
);

const Table = ({
  title, rows, total, empty,
}: {
  title: string;
  rows: { key: string; label: string; note: string; amount: string }[];
  total?: { label: string; amount: string } | undefined;
  empty: string;
}) => (
  <div className="rounded-[var(--radius-3)] bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)] overflow-hidden">
    <h2 className="px-4 pt-3.5 pb-2 text-[13px] font-medium text-[var(--fg-secondary)]">{title}</h2>
    {rows.length === 0 ? (
      <p className="px-4 pb-4 text-[13px] text-[var(--fg-muted)]">{empty}</p>
    ) : (
      <ul className="divide-y divide-[var(--line-subtle)]">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] truncate">{r.label}</span>
              <span className="block text-[12px] text-[var(--fg-tertiary)] truncate">{r.note}</span>
            </span>
            <Money minor={r.amount} mono className="text-[14px] font-medium" />
          </li>
        ))}
        {total ? (
          <li className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[var(--bg-surface-2)]">
            <span className="text-[13px] font-medium">{total.label}</span>
            <Money minor={total.amount} mono className="text-[14px] font-semibold" />
          </li>
        ) : null}
      </ul>
    )}
  </div>
);
