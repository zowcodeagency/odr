import { cn } from "../lib/cn.ts";

/**
 * Order lifecycle states (matches the API FSM in apps/api/src/modules/ordering).
 * Color-blind safe: each pill differs in hue AND brightness.
 */
export type OrderStatus =
  | "open"
  | "items_added"
  | "kot_fired"
  | "settled"
  | "voided"
  | "aggregator";

const LABEL: Record<OrderStatus, string> = {
  open: "Open",
  items_added: "Adding",
  kot_fired: "Fired",
  settled: "Settled",
  voided: "Voided",
  aggregator: "Aggregator",
};

const TONE: Record<OrderStatus, string> = {
  open:        "text-[var(--status-open)] before:bg-[var(--status-open)]",
  items_added: "text-[var(--status-firing)] before:bg-[var(--status-firing)]",
  kot_fired:   "text-[var(--status-fired)] before:bg-[var(--status-fired)]",
  settled:     "text-[var(--status-settled)] before:bg-[var(--status-settled)]",
  voided:      "text-[var(--status-voided)] before:bg-[var(--status-voided)]",
  aggregator:  "text-[var(--status-aggregator)] before:bg-[var(--status-aggregator)]",
};

export interface StatusPillProps {
  status: OrderStatus;
  className?: string;
  pulse?: boolean;
}

export const StatusPill = ({ status, className, pulse }: StatusPillProps) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5",
      "text-[11px] font-medium tracking-[0.01em]",
      "rounded-[var(--radius-pill)]",
      "before:content-[''] before:block before:h-1.5 before:w-1.5 before:rounded-full",
      pulse && "before:animate-pulse",
      "bg-[var(--bg-surface-2)] ring-1 ring-[var(--line-subtle)]",
      TONE[status],
      className,
    )}
  >
    {LABEL[status]}
  </span>
);
