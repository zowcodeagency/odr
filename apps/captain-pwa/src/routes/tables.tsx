import { useEffect, useMemo, useRef, useState } from "react";
import { Bike, Loader2, Plus, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Money,
  StatusPill,
  TableTile,
  type OrderStatus,
} from "@odr/ui";
import { api, type BillSummary, type Channel, type OpenOrder } from "../lib/api.ts";
import { navigate } from "../lib/router.ts";
import { useAsync } from "../lib/use-async.ts";
import { toast } from "../lib/toast.tsx";
import {
  CHANNEL_LABEL,
  CHANNEL_TONE,
  OFF_TABLE_CHANNELS,
  isOffTable,
  midnight,
  minutesSince,
} from "../features/ordering/channels.ts";
import { canSeeSales, type Session } from "../lib/session.ts";
import { getFloorLayout, type FloorLayout } from "../lib/branding.ts";

type FilterKey = "all" | "occupied" | "ready" | "free";



/** Soft color wash per stat card — only the Vivid layout uses these. */
const VIVID_TINTS = [
  "var(--accent)",
  "var(--status-fired)",
  "var(--status-settled)",
  "var(--status-firing)",
];

/** "ahmed.afrid@…" → "Ahmed" — friendly enough without a stored name. */
const greeting = (email: string): string => {
  const raw = email.split("@")[0]?.split(/[._-]/)[0] ?? "";
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "there";
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "occupied", label: "Occupied" },
  { key: "ready", label: "Ready to bill" },
  { key: "free", label: "Free" },
];

interface Tile {
  id: string;
  label: string;
  order?: OpenOrder;
}

export const TablesRoute = ({ session }: { session: Session }) => {
  const [filter, setFilter] = useState<FilterKey>("all");
  // Chosen in Branding → "Tables view"; the route re-mounts on navigation,
  // so a fresh read here is always current.
  const layout = getFloorLayout();
  const [opening, setOpening] = useState(false);
  const openingRef = useRef(false);
  const [pickTable, setPickTable] = useState(false);
  const [offTable, setOffTable] = useState(false);

  const outletId = session.outletId;
  const floor = useAsync(
    async () => {
      const [tables, orders] = await Promise.all([
        api.tables(outletId).catch(() => [] as { id: string; label: string }[]),
        api.openOrders(outletId),
      ]);
      return { tables, orders };
    },
    [outletId],
    5000,
  );

  const tables = floor.data?.tables ?? [];
  const orders = floor.data?.orders ?? [];

  const { tiles, offTableOrders } = useMemo(() => {
    const byLabel = new Map<string, OpenOrder>();
    const off: OpenOrder[] = [];
    for (const o of orders) {
      if (isOffTable(o.channel)) off.push(o);
      else byLabel.set(o.tableLabel, o);
    }
    const defined: Tile[] = tables.map((t) => ({
      id: t.id,
      label: t.label,
      ...(byLabel.get(t.label) ? { order: byLabel.get(t.label) as OpenOrder } : {}),
    }));
    // An order on a label nobody defined still has to be reachable.
    const extra: Tile[] = [...byLabel.entries()]
      .filter(([label]) => !tables.some((t) => t.label === label))
      .map(([label, order]) => ({ id: order.id, label, order }));
    return { tiles: [...defined, ...extra], offTableOrders: off };
  }, [tables, orders]);

  const stats = useMemo(() => {
    const occupied = tiles.filter((t) => t.order).length;
    const ready = tiles.filter((t) => t.order?.status === "kot_fired").length;
    const totalMinor = orders.reduce<bigint>((a, o) => a + BigInt(o.totalMinor), 0n);
    return { occupied, ready, free: tiles.length - occupied, totalMinor };
  }, [tiles, orders]);

  const visible = useMemo(() => {
    if (filter === "free") return tiles.filter((t) => !t.order);
    if (filter === "occupied") return tiles.filter((t) => t.order);
    if (filter === "ready") return tiles.filter((t) => t.order?.status === "kot_fired");
    return tiles;
  }, [tiles, filter]);

  const open = async (input: Parameters<typeof api.createOrder>[0]) => {
    // A ref, not the state flag: three taps in one tick all read the same
    // stale `opening === false` and open three orders on one table.
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    try {
      const order = await api.createOrder(input);
      navigate({ name: "order", orderId: order.id });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not open the order");
    } finally {
      openingRef.current = false;
      setOpening(false);
      setPickTable(false);
      setOffTable(false);
    }
  };

  const tap = (t: Tile) =>
    t.order
      ? navigate({ name: "order", orderId: t.order.id })
      : void open({ outletId, tableLabel: t.label });

  return (
    <div
      className="px-4 py-5 sm:px-6 sm:py-7 lg:px-10 max-w-[1440px] mx-auto"
      style={
        layout === "glassy"
          ? {
              backgroundImage:
                "radial-gradient(52% 30% at 12% 0%, color-mix(in oklab, var(--accent) 16%, transparent), transparent), radial-gradient(42% 26% at 92% 4%, color-mix(in oklab, var(--accent) 9%, transparent), transparent)",
            }
          : undefined
      }
    >
      <header className="flex flex-wrap items-center justify-between gap-3 mb-5 sm:mb-7">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-semibold tracking-[-0.02em]">
            Welcome back, {greeting(session.email)} 👋
          </h1>
          <p className="mt-1 text-[13px] text-[var(--fg-tertiary)]">
            {session.outletName} · {stats.occupied} of {tiles.length} occupied
            {floor.loading ? " · loading" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="lg" onClick={() => setOffTable(true)}>
            <Bike size={15} /> Off-table
          </Button>
          <Button size="lg" onClick={() => setPickTable(true)}>
            <Plus size={15} /> Open table
          </Button>
        </div>
      </header>

      {floor.error ? (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[var(--radius-3)] p-4 ring-1 ring-[var(--line-default)] bg-[var(--bg-surface)]">
          <span className="text-[13px] text-[var(--status-voided)]">{floor.error}</span>
          <Button size="sm" variant="outline" onClick={floor.reload}>
            <RefreshCw size={14} /> Retry
          </Button>
        </div>
      ) : null}

      {canSeeSales(session.role) ? <SalesGlance outletId={outletId} layout={layout} /> : null}

      {/* Stat strip — computed from the live floor. Shape follows the layout. */}
      {layout === "compact" ? (
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            `Occupied ${stats.occupied}/${tiles.length}`,
            `Ready ${stats.ready}`,
            `Free ${stats.free}`,
          ].map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center h-8 px-3 text-[12px] font-medium rounded-[var(--radius-pill)] ring-1 ring-[var(--line-default)] bg-[var(--bg-surface)]"
            >
              {chip}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-[var(--radius-pill)] ring-1 ring-[var(--line-default)] bg-[var(--bg-surface)]">
            Open <Money minor={stats.totalMinor} mono className="text-[12px]" />
          </span>
        </div>
      ) : (
        <section
          className={
            layout === "classic"
              ? "grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--line-default)] rounded-[var(--radius-3)] ring-1 ring-[var(--line-default)] overflow-hidden mb-5 sm:mb-7"
              : "grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5 sm:mb-7"
          }
        >
          {[
            { k: "Occupied", v: `${stats.occupied}`, hint: `of ${tiles.length} tables` },
            { k: "Ready to bill", v: `${stats.ready}`, hint: "KOTs awaiting settle" },
            { k: "Free", v: `${stats.free}`, hint: "walk-ins welcome" },
            { k: "Open value", v: null, hint: "across the floor" },
          ].map((s, i) => (
            <div
              key={s.k}
              className={
                layout === "classic"
                  ? "bg-[var(--bg-surface)] p-4 sm:p-5"
                  : "p-4 sm:p-5 rounded-[var(--radius-3)] ring-1 ring-[var(--line-subtle)] relative overflow-hidden"
              }
              style={
                layout === "vivid"
                  ? { background: `color-mix(in oklab, ${VIVID_TINTS[i]} 13%, var(--bg-surface))` }
                  : layout === "glassy"
                    ? {
                        background: "color-mix(in oklab, var(--bg-surface) 55%, transparent)",
                        backdropFilter: "blur(14px)",
                        WebkitBackdropFilter: "blur(14px)",
                        boxShadow: "var(--shadow-1)",
                      }
                    : layout === "premium"
                      ? { background: "var(--bg-surface)", boxShadow: "var(--shadow-2)" }
                      : undefined
              }
            >
              {layout === "premium" ? (
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-[3px]"
                  style={{
                    background: `linear-gradient(90deg, ${VIVID_TINTS[i]}, color-mix(in oklab, ${VIVID_TINTS[i]} 35%, transparent))`,
                  }}
                />
              ) : null}
              <p className="text-[12px] text-[var(--fg-tertiary)]">{s.k}</p>
              <p
                className="mt-1.5 text-[21px] sm:text-[24px] font-semibold leading-none tracking-[-0.02em] font-mono"
                style={
                  layout === "vivid" || layout === "premium" ? { color: VIVID_TINTS[i] } : undefined
                }
              >
                {s.v ?? <Money minor={stats.totalMinor} mono />}
              </p>
              <p className="mt-1.5 text-[12px] text-[var(--fg-muted)]">{s.hint}</p>
            </div>
          ))}
        </section>
      )}

      {/* Off-table strip */}
      {offTableOrders.length > 0 ? (
        <section className="mb-5 sm:mb-7">
          <h2 className="mb-2 text-[13px] font-medium text-[var(--fg-secondary)]">
            Off-table · {offTableOrders.length}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {offTableOrders.map((o) => (
              <button
                key={o.id}
                onClick={() => navigate({ name: "order", orderId: o.id })}
                className="flex items-center gap-3 min-h-[64px] p-3.5 text-left
                           rounded-[var(--radius-3)] bg-[var(--bg-surface)]
                           ring-1 ring-[var(--line-default)] hover:bg-[var(--bg-surface-2)]"
              >
                <Badge tone={CHANNEL_TONE[o.channel]}>{CHANNEL_LABEL[o.channel]}</Badge>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-medium truncate">
                    {o.customerName || o.aggregatorRef || o.tableLabel || "Walk-in"}
                  </span>
                  <span className="block text-[12px] text-[var(--fg-tertiary)]">
                    {o.lineCount} item{o.lineCount === 1 ? "" : "s"} ·{" "}
                    {minutesSince(o.createdAt)}m
                  </span>
                </span>
                <span className="text-right">
                  <Money minor={o.totalMinor} mono className="text-[14px] font-medium" />
                  <span className="mt-1 block">
                    <StatusPill status={o.status as OrderStatus} />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Filters */}
      <div
        role="tablist"
        className="inline-flex max-w-full p-1 gap-1 mb-4 rounded-[var(--radius-pill)]
                   bg-[var(--bg-surface-2)] ring-1 ring-[var(--line-subtle)]
                   overflow-x-auto [scrollbar-width:none]"
      >
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 whitespace-nowrap px-4 min-h-10 rounded-[var(--radius-pill)] text-[13px] transition-colors duration-[var(--dur-quick)] ${
              filter === f.key
                ? "bg-[var(--bg-surface)] font-medium shadow-[var(--shadow-1)]"
                : "text-[var(--fg-muted)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Floor grid */}
      {floor.loading && tiles.length === 0 ? (
        <section
          aria-busy
          aria-label="floor plan"
          className={layout === "compact" ? "grid gap-2" : "grid gap-2.5 sm:gap-3"}
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${layout === "compact" ? 116 : 150}px, 1fr))`,
          }}
        >
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="min-h-[132px] rounded-[var(--radius-3)] bg-[var(--bg-surface-2)] animate-pulse"
            />
          ))}
        </section>
      ) : visible.length === 0 ? (
        <div className="rounded-[var(--radius-3)] ring-1 ring-[var(--line-default)] bg-[var(--bg-surface)] p-8 text-center">
          {filter === "all" ? (
            <>
              <p className="text-[15px] font-medium">No tables yet</p>
              <p className="mt-1.5 text-[13px] text-[var(--fg-tertiary)]">
                Add your tables in Settings and they'll show up here.
              </p>
              <Button
                size="lg"
                className="mt-5"
                onClick={() => navigate({ name: "settings" })}
              >
                Go to Settings
              </Button>
            </>
          ) : (
            <>
              <p className="text-[15px] font-medium">Nothing matches this filter</p>
              <p className="mt-1.5 text-[13px] text-[var(--fg-tertiary)]">
                No table is {FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} right now.
              </p>
              <Button size="lg" variant="outline" className="mt-5" onClick={() => setFilter("all")}>
                Show all
              </Button>
            </>
          )}
        </div>
      ) : (
        <section
          aria-label="floor plan"
          className={layout === "compact" ? "grid gap-2" : "grid gap-2.5 sm:gap-3"}
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${layout === "compact" ? 116 : 150}px, 1fr))`,
          }}
        >
          {visible.map((t) => (
            <TableTile
              key={t.id}
              label={t.label}
              className={layout === "compact" ? "min-h-[96px] p-3" : undefined}
              status={(t.order?.status as OrderStatus) ?? "free"}
              {...(t.order ? { totalMinor: t.order.totalMinor } : {})}
              {...(t.order ? { ageMinutes: minutesSince(t.order.createdAt) } : {})}
              badge={
                t.order && t.order.channel !== "dine_in" ? (
                  <Badge tone={CHANNEL_TONE[t.order.channel]}>
                    {CHANNEL_LABEL[t.order.channel]}
                  </Badge>
                ) : null
              }
              onClick={() => tap(t)}
            />
          ))}
        </section>
      )}

      <PickTableDialog
        open={pickTable}
        onOpenChange={setPickTable}
        busy={opening}
        free={tiles.filter((t) => !t.order).map((t) => t.label)}
        onPick={(label) => void open({ outletId, tableLabel: label })}
      />
      <OffTableDialog
        open={offTable}
        onOpenChange={setOffTable}
        busy={opening}
        onSubmit={(channel, who) =>
          void open({
            outletId,
            channel,
            tableLabel: CHANNEL_LABEL[channel],
            ...(channel === "parcel" || channel === "other"
              ? { customerName: who }
              : { aggregatorRef: who }),
          })
        }
      />
    </div>
  );
};

const PickTableDialog = ({
  open,
  onOpenChange,
  free,
  busy,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  free: string[];
  busy: boolean;
  onPick: (label: string) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogTitle>Open a table</DialogTitle>
      <DialogDescription>
        {free.length > 0 ? "Pick a free table." : "Every table is occupied."}
      </DialogDescription>
      <div className="mt-5 flex flex-wrap gap-2">
        {free.map((label) => (
          <button
            key={label}
            disabled={busy}
            onClick={() => onPick(label)}
            className="min-h-12 min-w-[76px] px-4 text-[15px] font-medium
                       rounded-[var(--radius-2)] ring-1 ring-[var(--line-default)]
                       hover:bg-[var(--bg-surface-2)] disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);

const OffTableDialog = ({
  open,
  onOpenChange,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  busy: boolean;
  onSubmit: (channel: Channel, who: string) => void;
}) => {
  const [channel, setChannel] = useState<Channel>("parcel");
  const [who, setWho] = useState("");
  const aggregator = channel === "zomato" || channel === "swiggy";
  // Each off-table order starts clean — never pre-fill the last one.
  useEffect(() => {
    if (!open) {
      setChannel("parcel");
      setWho("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Off-table order</DialogTitle>
        <DialogDescription>Parcel counter and aggregator pickups.</DialogDescription>

        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(channel, who.trim());
          }}
        >
          <div className="flex flex-wrap gap-2">
            {OFF_TABLE_CHANNELS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChannel(c)}
                className={
                  channel === c
                    ? "min-h-12 px-4 text-[14px] font-medium rounded-[var(--radius-2)] bg-[var(--accent)] text-[var(--fg-on-accent)]"
                    : "min-h-12 px-4 text-[14px] rounded-[var(--radius-2)] ring-1 ring-[var(--line-default)] hover:bg-[var(--bg-surface-2)]"
                }
              >
                {CHANNEL_LABEL[c]}
              </button>
            ))}
          </div>

          <label className="mt-5 block">
            <span className="block text-[13px] font-medium text-[var(--fg-secondary)] mb-1.5">
              {aggregator ? "Order reference" : "Customer name"}
            </span>
            <Input
              value={who}
              onChange={(e) => setWho(e.target.value)}
              placeholder={aggregator ? "e.g. 8842-1190" : "e.g. Rakesh"}
              className="h-11"
            />
          </label>

          <Button type="submit" size="lg" disabled={busy} className="mt-6 w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            Start order
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/* -------------------------------------------------------- sales at a glance -- */

const DAYS = 7;

const rupees = (minor: bigint): string =>
  `₹${(Number(minor) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/**
 * Today's takings with a 7-day mini bar chart — the "good morning" glance
 * before service starts. Reuses the bills list; no separate stats endpoint.
 */
const SalesGlance = ({ outletId, layout }: { outletId: string; layout: FloorLayout }) => {
  const q = useAsync(() => api.bills(outletId, midnight(DAYS - 1).toISOString()), [outletId]);

  const days = useMemo(() => {
    const bills: BillSummary[] = q.data ?? [];
    return Array.from({ length: DAYS }, (_, i) => {
      const start = midnight(DAYS - 1 - i).getTime();
      const end = midnight(DAYS - 2 - i).getTime(); // midnight(-1) = tomorrow
      return {
        label: new Date(start).toLocaleDateString("en-IN", { weekday: "narrow" }),
        title: new Date(start).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        minor: bills
          .filter((b) => {
            const t = Date.parse(b.settledAt);
            return t >= start && t < end;
          })
          .reduce<bigint>((a, b) => a + BigInt(b.grandTotalMinor), 0n),
      };
    });
  }, [q.data]);

  // The floor screen must never break over takings — just drop the card.
  if (q.error || (q.loading && !q.data)) return null;

  const today = days[DAYS - 1]!.minor;
  const yesterday = days[DAYS - 2]!.minor;
  const delta = yesterday === 0n ? null : Number(((today - yesterday) * 100n) / yesterday);
  const max = days.reduce((m, d) => (d.minor > m ? d.minor : m), 1n);

  // Compact: one quiet line, no chart — the floor gets the space instead.
  if (layout === "compact") {
    return (
      <p className="mb-4 flex items-baseline gap-2 text-[13px] text-[var(--fg-secondary)]">
        <span className="text-[var(--fg-tertiary)]">Sales today</span>
        <Money minor={today} mono className="text-[15px] font-semibold" />
        {delta !== null ? (
          <span style={{ color: delta >= 0 ? "var(--status-settled)" : "var(--status-voided)" }}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
          </span>
        ) : null}
      </p>
    );
  }

  const vivid = layout === "vivid";
  const premium = layout === "premium";
  // On the premium gradient every text sits on the accent — theme inks vanish.
  const onHero = "var(--fg-on-accent)";
  const onHeroSoft = `color-mix(in oklab, ${onHero} 72%, transparent)`;
  const heroStyle =
    layout === "vivid"
      ? {
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--accent) 22%, var(--bg-surface)), var(--bg-surface) 65%)",
        }
      : layout === "glassy"
        ? {
            background: "color-mix(in oklab, var(--bg-surface) 55%, transparent)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            boxShadow: "var(--shadow-1)",
          }
        : layout === "premium"
          ? {
              background:
                "linear-gradient(135deg, var(--accent), oklch(from var(--accent) calc(l - 0.14) calc(c * 1.05) calc(h + 18)))",
              boxShadow: "var(--shadow-2)",
            }
          : undefined;
  return (
    <section
      className="mb-5 sm:mb-7 p-4 sm:p-5 flex items-end justify-between gap-4
                 rounded-[var(--radius-3)] ring-1 ring-[var(--line-default)] bg-[var(--bg-surface)]"
      style={heroStyle}
    >
      <div className="min-w-0">
        <p className="text-[12px] text-[var(--fg-tertiary)]" style={premium ? { color: onHeroSoft } : undefined}>
          Sales today
        </p>
        <p
          className="mt-1.5 text-[24px] sm:text-[28px] font-semibold leading-none tracking-[-0.02em]"
          style={vivid ? { color: "var(--accent)" } : premium ? { color: onHero } : undefined}
        >
          <Money minor={today} mono />
        </p>
        <p className="mt-2 text-[12px] text-[var(--fg-muted)]" style={premium ? { color: onHeroSoft } : undefined}>
          {delta === null ? (
            "no sales yesterday"
          ) : (
            <>
              <span
                className="font-medium"
                style={
                  premium
                    ? { color: onHero }
                    : { color: delta >= 0 ? "var(--status-settled)" : "var(--status-voided)" }
                }
              >
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
              </span>{" "}
              vs yesterday · {rupees(yesterday)}
            </>
          )}
        </p>
      </div>

      {/* One series, one hue — today carries the full accent. */}
      <div className="flex items-end gap-1.5 sm:gap-2" role="img" aria-label="Sales, last 7 days">
        {days.map((d, i) => (
          <div key={d.title} className="flex flex-col items-center gap-1" title={`${d.title} · ${rupees(d.minor)}`}>
            <span
              className="w-2.5 rounded-full"
              style={{
                height: `${6 + Math.round((Number(d.minor) / Number(max)) * 40)}px`,
                background: premium
                  ? i === DAYS - 1
                    ? onHero
                    : `color-mix(in oklab, ${onHero} 35%, transparent)`
                  : i === DAYS - 1
                    ? "var(--accent)"
                    : `color-mix(in oklab, var(--accent) ${vivid ? 55 : 30}%, var(--bg-surface-3))`,
              }}
            />
            <span
              className="text-[10px] leading-none text-[var(--fg-muted)]"
              style={premium ? { color: onHeroSoft } : undefined}
            >
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};
