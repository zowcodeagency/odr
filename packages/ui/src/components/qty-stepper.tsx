import { Minus, Plus } from "lucide-react";
import { cn } from "../lib/cn.ts";

export interface QtyStepperProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: "md" | "lg";
  className?: string;
}

export const QtyStepper = ({
  value,
  onChange,
  min = 0,
  max = 99,
  size = "md",
  className,
}: QtyStepperProps) => {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  const dim = size === "lg" ? "h-12 w-12 text-base" : "h-10 w-10 text-sm";
  return (
    <div
      className={cn(
        "inline-flex items-center",
        "bg-[var(--bg-surface-2)] ring-1 ring-[var(--line-subtle)]",
        "rounded-[var(--radius-2)]",
        className,
      )}
    >
      <button
        aria-label="decrement"
        onClick={dec}
        disabled={value <= min}
        className={cn(
          dim,
          "grid place-items-center text-[var(--fg-secondary)]",
          "hover:text-[var(--fg-primary)] disabled:opacity-30",
          "rounded-l-[var(--radius-2)]",
        )}
      >
        <Minus size={16} />
      </button>
      <span
        className={cn(
          "min-w-[2.25rem] text-center font-mono tabular-nums",
          size === "lg" ? "text-[18px]" : "text-[15px]",
        )}
      >
        {value}
      </span>
      <button
        aria-label="increment"
        onClick={inc}
        disabled={value >= max}
        className={cn(
          dim,
          "grid place-items-center text-[var(--fg-primary)]",
          "rounded-r-[var(--radius-2)]",
          "hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]",
        )}
      >
        <Plus size={16} />
      </button>
    </div>
  );
};
