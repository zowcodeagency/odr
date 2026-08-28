import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";

export interface KotItem {
  name: string;
  qty: number;
  modifiers?: string[];
  note?: string;
}

export interface KotTicketProps {
  /** "KOT-0042" — the human-readable id. */
  number: string;
  tableLabel: string;
  captain?: string;
  /** Channel marker, shown beside the KOT number. */
  badge?: ReactNode;
  /** ISO time the KOT was fired. */
  firedAt: Date;
  items: KotItem[];
  /** Minutes since fired — drives the urgency band on the left edge. */
  ageMinutes: number;
  /** Kitchen bump. Renders a full-width Done button when provided. */
  onBump?: () => void;
  bumping?: boolean;
  className?: string;
}

/** Age band: green < 5m, amber < 12m, red ≥ 12m. Tokens are theme-tuned. */
const ageTone = (m: number): string => {
  if (m < 5) return "before:bg-[var(--status-settled)]";
  if (m < 12) return "before:bg-[var(--status-firing)]";
  return "before:bg-[var(--status-voided)]";
};

const ageText = (m: number): string => {
  if (m < 5) return "text-[var(--status-settled)]";
  if (m < 12) return "text-[var(--status-firing)]";
  return "text-[var(--status-voided)]";
};

const formatTime = (d: Date) =>
  d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/**
 * Kitchen Display Screen ticket. Designed to be read across the room:
 * 16+px body, 28px item names, monospaced numbers, color-blind safe age band.
 */
export const KotTicket = ({
  number,
  tableLabel,
  captain,
  badge,
  firedAt,
  items,
  ageMinutes,
  onBump,
  bumping,
  className,
}: KotTicketProps) => (
  <article
    className={cn(
      "relative bg-[var(--bg-surface)] text-[var(--fg-primary)]",
      "rounded-[var(--radius-3)] ring-1 ring-[var(--line-default)]",
      "pl-5 pr-4 py-4 min-w-[280px] overflow-hidden",
      "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1",
      ageTone(ageMinutes),
      className,
    )}
  >
    <header className="flex items-baseline justify-between gap-3 mb-3">
      <div>
        <h3 className="text-[26px] font-semibold leading-none tracking-[-0.02em]">
          {tableLabel}
        </h3>
        <p className="mt-1.5 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)] font-mono">
          <span>
            {number}
            {captain ? ` · ${captain}` : ""}
          </span>
          {badge}
        </p>
      </div>
      <div className="text-right">
        <p className={cn("font-mono text-[18px] font-medium tabular-nums", ageText(ageMinutes))}>
          {ageMinutes}m
        </p>
        <p className="text-[11px] font-mono text-[var(--fg-muted)]">{formatTime(firedAt)}</p>
      </div>
    </header>

    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i}>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[24px] leading-none tabular-nums w-8 text-[var(--accent)]">
              {it.qty}×
            </span>
            <span className="text-[19px] leading-tight font-medium tracking-tight">
              {it.name}
            </span>
          </div>
          {it.modifiers && it.modifiers.length > 0 ? (
            <ul className="mt-0.5 ml-11 text-[14px] text-[var(--fg-tertiary)]">
              {it.modifiers.map((m, j) => (
                <li key={j}>+ {m}</li>
              ))}
            </ul>
          ) : null}
          {it.note ? (
            <p className="ml-11 mt-1 text-[13px] italic text-[var(--status-firing)]">
              ✱ {it.note}
            </p>
          ) : null}
        </li>
      ))}
    </ul>

    {onBump ? (
      <button
        type="button"
        onClick={onBump}
        disabled={bumping}
        className={cn(
          "mt-4 w-full h-12 rounded-[var(--radius-2)]",
          "bg-[var(--accent)] text-[var(--fg-on-accent)]",
          "text-[16px] font-semibold tracking-[-0.01em]",
          "hover:bg-[var(--accent-hover)] disabled:opacity-50",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
        )}
      >
        {bumping ? "Bumping…" : "Done"}
      </button>
    ) : null}
  </article>
);
