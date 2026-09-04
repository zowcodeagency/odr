import { useMemo, useState } from "react";
import { HardDrive, Phone, Search } from "lucide-react";
import { Money, StatusPill, type OrderStatus } from "@odr/ui";
import { api, type BillSummary } from "../lib/api.ts";
import { navigate } from "../lib/router.ts";
import { useAsync } from "../lib/use-async.ts";
import { midnight, minutesSince } from "../features/ordering/channels.ts";
import { canManage, canSeeSales, type Session } from "../lib/session.ts";
import { localBills } from "../lib/local-db.ts";


const sum = (bills: BillSummary[]) =>
  bills.reduce<bigint>((a, b) => a + BigInt(b.grandTotalMinor), 0n);

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export const BillsRoute = ({ session }: { session: Session }) => {
  const [q, setQ] = useState("");
  const canAll = canManage(session.role) && session.outlets.length > 1;
  const [scope, setScope] = useState<"outlet" | "all">("outlet");
  const all = canAll && scope === "all";
  const outletId = session.outletId;

  // Two days of invoices plus what's still open answers every question on this
  // screen — no separate stats endpoint to keep in sync.
  const data = useAsync(
    async () => {
      const [cloud, open, device] = await Promise.all([
        api.bills(all ? null : outletId, midnight(1).toISOString()),
        // Open orders stay per outlet — the floor is a place, takings are a total.
        api.openOrders(outletId),
        // Bills this device kept and has not synced — the cloud list lacks them.
        localBills.list(outletId, midnight(1).toISOString()).catch(() => []),
      ]);
      const seen = new Set(cloud.map((b) => b.id));
      const bills: (BillSummary & { local?: boolean })[] = [
        ...cloud,
        ...device.filter((b) => !seen.has(b.id) && !b.syncedAt).map((b) => ({ ...b, local: true })),
      ].sort((a, b) => b.settledAt.localeCompare(a.settledAt));
      return { bills, open };
    },
    [outletId, all],
    15000,
  );

  const bills = data.data?.bills ?? [];
  const open = data.data?.open ?? [];

  const insight = useMemo(() => {
    const start = midnight().getTime();
    const today = bills.filter((b) => Date.parse(b.settledAt) >= start);
    const yesterday = bills.filter((b) => Date.parse(b.settledAt) < start);
    return {
      today,
      yesterday,
      openValue: open.reduce<bigint>((a, o) => a + BigInt(o.totalMinor), 0n),
    };
  }, [bills, open]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return bills;
    return bills.filter((b) =>
      [b.invoiceNumber, b.customerName, b.customerPhone]
        .some((f) => f?.toLowerCase().includes(needle)),
    );
  }, [bills, q]);

  const delta = (() => {
    const y = sum(insight.yesterday);
    if (y === 0n) return null;
    const t = sum(insight.today);
    return Number(((t - y) * 100n) / y);
  })();

  const outletName = (id: string) => session.outlets.find((o) => o.id === id)?.name ?? "";

  if (!canSeeSales(session.role)) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-[15px] font-medium">Takings are for cashiers, managers and owners</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-7 lg:px-10 max-w-[1100px] mx-auto">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-semibold tracking-[-0.02em]">Sales &amp; invoices</h1>
          <p className="mt-1 text-[13px] text-[var(--fg-tertiary)]">
            {all ? `All ${session.outlets.length} outlets` : session.outletName} · refreshes every 15 seconds
          </p>
        </div>
        {canAll ? (
          <div
            role="tablist"
            aria-label="sales scope"
            className="flex p-1 gap-1 rounded-[var(--radius-pill)] bg-[var(--bg-surface-2)] ring-1 ring-[var(--line-subtle)]"
          >
            {([["outlet", "This outlet"], ["all", "All outlets"]] as const).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={scope === k}
                onClick={() => setScope(k)}
                className={`px-4 min-h-10 rounded-[var(--radius-pill)] text-[13px] transition-colors duration-[var(--dur-quick)] ${
                  scope === k ? "bg-[var(--bg-surface)] font-medium shadow-[var(--shadow-1)]" : "text-[var(--fg-muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {/* Done vs not done, today against yesterday. */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--line-default)] rounded-[var(--radius-3)] ring-1 ring-[var(--line-default)] overflow-hidden mb-6">
        <Stat
          label="Settled today"
          value={<Money minor={sum(insight.today)} mono />}
          hint={`${insight.today.length} bill${insight.today.length === 1 ? "" : "s"}${
            delta === null ? "" : ` · ${delta >= 0 ? "+" : ""}${delta}% vs yesterday`
          }`}
        />
        <Stat
          label="Settled yesterday"
          value={<Money minor={sum(insight.yesterday)} mono />}
          hint={`${insight.yesterday.length} bill${insight.yesterday.length === 1 ? "" : "s"}`}
        />
        <Stat
          label="Still open"
          value={<Money minor={insight.openValue} mono />}
          hint={
            all
              ? `${session.outletName} only`
              : `${open.length} order${open.length === 1 ? "" : "s"} on the floor`
          }
        />
        <Stat
          label="Taken today"
          value={<Money minor={all ? sum(insight.today) : sum(insight.today) + insight.openValue} mono />}
          hint={all ? "settled · all outlets" : "settled + still open"}
        />
      </section>

      {all ? (
        <section className="mb-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {session.outlets.map((o) => {
            const mine = insight.today.filter((b) => b.outletId === o.id);
            return (
              <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-[var(--radius-3)] bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]">
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium truncate">{o.name}</span>
                  <span className="block text-[12px] text-[var(--fg-tertiary)]">{mine.length} bill{mine.length === 1 ? "" : "s"} today</span>
                </span>
                <Money minor={sum(mine)} mono className="text-[15px] font-medium" />
              </div>
            );
          })}
        </section>
      ) : null}

      {/* Not done — the orders that have not turned into money yet. */}
      {!all && open.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 text-[13px] font-medium text-[var(--fg-secondary)]">
            Not settled yet · {open.length}
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
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <h2 className="text-[13px] font-medium text-[var(--fg-secondary)]">
          Invoices · today and yesterday
        </h2>
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Invoice, name or phone"
            className="h-11 w-[210px] pl-9 pr-3 rounded-[var(--radius-2)]
                       bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]
                       text-[13px] placeholder:text-[var(--fg-muted)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
      </div>

      {data.loading && !data.data ? (
        <p className="text-[13px] text-[var(--fg-muted)]">Loading…</p>
      ) : data.error ? (
        <p className="text-[13px] text-[var(--status-voided)]">{data.error}</p>
      ) : visible.length === 0 ? (
        <div className="rounded-[var(--radius-3)] ring-1 ring-[var(--line-default)] bg-[var(--bg-surface)] p-8 text-center">
          <p className="text-[14px] text-[var(--fg-tertiary)]">
            {q ? `Nothing matches "${q}".` : "No bills settled yet today."}
          </p>
        </div>
      ) : (
        <ul className="rounded-[var(--radius-3)] ring-1 ring-[var(--line-default)] bg-[var(--bg-surface)] overflow-hidden divide-y divide-[var(--line-subtle)]">
          {visible.map((b) => (
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
                    {time(b.settledAt)}
                    {b.customerName ? ` · ${b.customerName}` : ""}
                    {b.customerPhone ? ` · ${b.customerPhone}` : ""}
                  </span>
                </span>
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
          ))}
        </ul>
      )}
    </div>
  );
};

const Stat = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
}) => (
  <div className="bg-[var(--bg-surface)] p-4 sm:p-5">
    <p className="text-[12px] text-[var(--fg-tertiary)]">{label}</p>
    <p className="mt-1.5 text-[21px] sm:text-[24px] font-semibold leading-none tracking-[-0.02em] font-mono">
      {value}
    </p>
    <p className="mt-1.5 text-[12px] text-[var(--fg-muted)]">{hint}</p>
  </div>
);
