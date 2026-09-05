import { useState } from "react";
import { Badge, KotTicket } from "@odr/ui";
import { api } from "../lib/api.ts";
import { useAsync } from "../lib/use-async.ts";
import { toast } from "../lib/toast.tsx";
import { CHANNEL_LABEL, CHANNEL_TONE, minutesSince } from "../features/ordering/channels.ts";
import type { Session } from "../lib/session.ts";

/** The API numbers KOTs sequentially; the kitchen reads "KOT-0004". */
const kotNumber = (n: string | number): string =>
  /^\d+$/.test(String(n)) ? `KOT-${String(n).padStart(4, "0")}` : String(n);

const BANDS: [string, string][] = [
  ["< 5 min", "var(--status-settled)"],
  ["< 12 min", "var(--status-firing)"],
  ["≥ 12 min", "var(--status-voided)"],
];

export const KdsRoute = ({ session }: { session: Session }) => {
  const [bumping, setBumping] = useState<string | null>(null);
  const q = useAsync(() => api.kots(session.outletId), [session.outletId], 5000);
  const kots = q.data ?? [];

  const bump = async (id: string) => {
    setBumping(id);
    try {
      await api.bumpKot(id);
      q.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bump failed");
    } finally {
      setBumping(null);
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-[var(--bg-canvas)]">
      {/* The shell supplies navigation and the theme toggle; this row is the pass's own status line. */}
      <header className="flex px-4 sm:px-6 py-3 items-center gap-3 border-b border-[var(--line-subtle)]">
        <div className="flex-1 min-w-0">
          <h1 className="text-[16px] font-semibold tracking-[-0.01em] truncate">Kitchen display</h1>
          <p className="text-[13px] text-[var(--fg-tertiary)]">
            {kots.length} KOT{kots.length === 1 ? "" : "s"} in flight
          </p>
        </div>
        <span className="font-mono text-[15px] font-medium text-[var(--fg-secondary)]">
          {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </header>

      {q.loading && kots.length === 0 ? (
        <div className="flex-1 px-4 py-16 text-center text-[15px] text-[var(--fg-muted)]">
          Loading the pass…
        </div>
      ) : q.error ? (
        <div className="flex-1 px-4 py-16 text-center text-[15px] text-[var(--status-voided)]">
          {q.error}
        </div>
      ) : kots.length === 0 ? (
        <div className="flex-1 px-4 py-16 text-center text-[18px] text-[var(--fg-muted)]">
          Nothing in the pass. Fired KOTs land here within 5 seconds.
        </div>
      ) : (
        <section
          className="flex-1 p-4 sm:p-6 grid gap-4 content-start"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))" }}
        >
          {kots.map((k) => (
            <KotTicket
              key={k.id}
              number={kotNumber(k.number)}
              tableLabel={k.tableLabel || CHANNEL_LABEL[k.channel ?? "dine_in"]}
              {...(k.channel && k.channel !== "dine_in"
                ? {
                    badge: (
                      <Badge tone={CHANNEL_TONE[k.channel]}>{CHANNEL_LABEL[k.channel]}</Badge>
                    ),
                  }
                : {})}
              firedAt={new Date(k.firedAt)}
              ageMinutes={minutesSince(k.firedAt)}
              items={k.lines.map((l) => ({
                name: l.itemName,
                qty: l.qty,
                ...(l.note ? { note: l.note } : {}),
              }))}
              onBump={() => void bump(k.id)}
              bumping={bumping === k.id}
            />
          ))}
        </section>
      )}

      <footer className="px-4 sm:px-6 pb-6 flex items-center gap-5 text-[12px] text-[var(--fg-tertiary)]">
        {BANDS.map(([label, color]) => (
          <span key={label} className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} />
            {label}
          </span>
        ))}
      </footer>
    </div>
  );
};
