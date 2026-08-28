import { cva, type VariantProps } from "class-variance-authority";
import { type HTMLAttributes } from "react";
import { cn } from "../lib/cn.ts";

const badge = cva(
  [
    "inline-flex items-center gap-1.5 px-2 py-[3px]",
    "text-[11px] font-medium uppercase tracking-[0.08em]",
    "rounded-[var(--radius-pill)]",
  ],
  {
    variants: {
      tone: {
        neutral: "bg-[var(--bg-surface-3)] text-[var(--fg-secondary)]",
        accent:  "bg-[var(--accent-soft)] text-[var(--accent)]",
        veg:     "bg-[color-mix(in_oklab,var(--status-settled)_18%,transparent)] text-[var(--status-settled)]",
        nonveg:  "bg-[color-mix(in_oklab,var(--status-voided)_18%,transparent)] text-[var(--status-voided)]",
        warn:    "bg-[color-mix(in_oklab,var(--status-firing)_18%,transparent)] text-[var(--status-firing)]",
        info:    "bg-[color-mix(in_oklab,var(--status-aggregator)_18%,transparent)] text-[var(--status-aggregator)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

export const Badge = ({ className, tone, ...props }: BadgeProps) => (
  <span className={cn(badge({ tone }), className)} {...props} />
);
