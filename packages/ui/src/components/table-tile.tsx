import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";
import { Money } from "./money.tsx";
import { StatusPill, type OrderStatus } from "./status-pill.tsx";
import type { Currency } from "../lib/money.ts";

export interface TableTileProps {
  label: string;          // "T-3", "Window-2"
  status: OrderStatus | "free";
  /** Channel marker (QR, Zomato…) rendered under the status pill. */
  badge?: ReactNode;
  /** Captain's initial (e.g. "AS"). Shown as a discreet ribbon. */
  captain?: string;
  covers?: number;
  totalMinor?: bigint | string;
  currency?: Currency;
  /** Minutes since the order opened — drives a subtle accent border at >30. */
  ageMinutes?: number;
  onClick?: () => void;
  className?: string;
}

const stateBg: Record<OrderStatus | "free", string> = {
  free:        "bg-[var(--bg-surface)]",
  open:        "bg-[var(--bg-surface)]",
  items_added: "bg-[color-mix(in_oklab,var(--status-firing)_8%,var(--bg-surface))]",
  kot_fired:   "bg-[color-mix(in_oklab,var(--status-fired)_10%,var(--bg-surface))]",
  settled:     "bg-[color-mix(in_oklab,var(--status-settled)_8%,var(--bg-surface))]",
  voided:      "bg-[color-mix(in_oklab,var(--status-voided)_6%,var(--bg-surface))]",
  aggregator:  "bg-[color-mix(in_oklab,var(--status-aggregator)_8%,var(--bg-surface))]",
};

export const TableTile = ({
  label,
  status,
  badge,
  captain,
  covers,
  totalMinor,
  currency = "INR",
  ageMinutes,
  onClick,
  className,
}: TableTileProps) => {
  const aged = (ageMinutes ?? 0) > 30 && status !== "settled" && status !== "free";
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative text-left p-4 min-h-[132px] flex flex-col justify-between gap-3",
        "rounded-[var(--radius-3)] ring-1 ring-[var(--line-default)]",
        "transition-colors duration-[var(--dur-quick)]",
        "hover:ring-[var(--line-strong)] hover:bg-[var(--bg-surface-2)]",
        "focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        stateBg[status],
        aged && "ring-[var(--accent)]/60",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-[24px] font-semibold leading-none tracking-[-0.02em]">
            {label}
          </span>
          {covers != null ? (
            <span className="text-[12px] text-[var(--fg-tertiary)]">
              {covers} cover{covers === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <span className="flex flex-col items-end gap-1">
          {status !== "free" ? <StatusPill status={status} /> : null}
          {badge}
        </span>
      </div>

      <div className="flex items-end justify-between gap-2">
        {totalMinor != null ? (
          <Money
            minor={totalMinor}
            currency={currency}
            mono
            className="text-[18px] font-medium text-[var(--fg-primary)]"
          />
        ) : (
          <span className="text-[12px] text-[var(--fg-muted)] uppercase tracking-[0.10em]">
            Free
          </span>
        )}
        {captain ? (
          <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)] font-mono">
            {captain}
          </span>
        ) : null}
      </div>

      {aged ? (
        <span className="absolute top-1.5 right-1.5 text-[10px] font-mono text-[var(--accent)]">
          {ageMinutes}m
        </span>
      ) : null}
    </button>
  );
};
