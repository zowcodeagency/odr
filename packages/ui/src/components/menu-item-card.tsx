import { Plus } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Money } from "./money.tsx";
import { VegMark } from "./veg-mark.tsx";
import type { Currency } from "../lib/money.ts";

export interface MenuItemCardProps {
  name: string;
  description?: string;
  basePriceMinor: bigint | string;
  currency?: Currency;
  isVeg: boolean;
  taxClass?: string;          // e.g. GST_5
  outOfStock?: boolean;       // 86'ed
  onAdd?: () => void;
  className?: string;
}

export const MenuItemCard = ({
  name,
  description,
  basePriceMinor,
  currency = "INR",
  isVeg,
  taxClass,
  outOfStock,
  onAdd,
  className,
}: MenuItemCardProps) => (
  <div
    className={cn(
      "group relative flex items-stretch gap-4 p-4",
      "bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]",
      "rounded-[var(--radius-3)]",
      "transition-all duration-[var(--dur-quick)]",
      "hover:ring-[var(--line-strong)] hover:bg-[var(--bg-surface-2)]",
      outOfStock && "opacity-50",
      className,
    )}
  >
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <VegMark veg={isVeg} />
        <h4 className="text-[16px] font-medium leading-tight tracking-tight truncate">
          {name}
        </h4>
      </div>
      {description ? (
        <p className="mt-1 text-[13px] text-[var(--fg-tertiary)] line-clamp-2">
          {description}
        </p>
      ) : null}
      <div className="mt-2 flex items-baseline gap-2">
        <Money
          minor={basePriceMinor}
          currency={currency}
          mono
          className="text-[15px] font-medium"
        />
        {taxClass ? (
          <span className="text-[10px] font-mono text-[var(--fg-muted)] uppercase tracking-[0.1em]">
            · {taxClass.replace("_", " ")}
          </span>
        ) : null}
        {outOfStock ? (
          <span className="text-[10px] font-mono text-[var(--status-voided)] uppercase tracking-[0.12em]">
            · 86'ed
          </span>
        ) : null}
      </div>
    </div>

    <button
      type="button"
      aria-label={`Add ${name}`}
      onClick={onAdd}
      disabled={outOfStock}
      className={cn(
        "self-center grid place-items-center",
        "h-11 w-11 rounded-[var(--radius-2)]",
        "bg-[var(--bg-surface-3)] text-[var(--fg-secondary)]",
        "ring-1 ring-[var(--line-default)]",
        "transition-colors duration-[var(--dur-quick)]",
        "group-hover:bg-[var(--accent)] group-hover:text-[var(--fg-on-accent)]",
        "disabled:opacity-30 disabled:pointer-events-none",
      )}
    >
      <Plus size={18} />
    </button>
  </div>
);
