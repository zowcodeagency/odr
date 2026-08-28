import { Trash2 } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Money } from "./money.tsx";
import { QtyStepper } from "./qty-stepper.tsx";
import { VegMark } from "./veg-mark.tsx";
import type { Currency } from "../lib/money.ts";

export interface CartLineProps {
  name: string;
  qty: number;
  unitPriceMinor: bigint | string;
  modifiers?: { name: string; priceDeltaMinor: bigint | string }[];
  currency?: Currency;
  isVeg?: boolean;
  /** Kitchen instruction. Editable when `onNoteChange` is given. */
  note?: string;
  onNoteChange?: (v: string) => void;
  onQtyChange: (v: number) => void;
  onRemove?: () => void;
  className?: string;
}

const sumMinor = (
  unit: bigint | string,
  qty: number,
  mods: { priceDeltaMinor: bigint | string }[] = [],
): bigint => {
  const u = typeof unit === "bigint" ? unit : BigInt(unit);
  const m = mods.reduce<bigint>(
    (a, x) => a + (typeof x.priceDeltaMinor === "bigint" ? x.priceDeltaMinor : BigInt(x.priceDeltaMinor)),
    0n,
  );
  return (u + m) * BigInt(qty);
};

export const CartLine = ({
  name,
  qty,
  unitPriceMinor,
  modifiers = [],
  currency = "INR",
  isVeg,
  note,
  onNoteChange,
  onQtyChange,
  onRemove,
  className,
}: CartLineProps) => (
  <div
    className={cn(
      "flex items-start gap-3 py-3",
      "border-b border-[var(--line-subtle)] last:border-0",
      className,
    )}
  >
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        {isVeg != null ? <VegMark veg={isVeg} /> : null}
        <h5 className="text-[14px] font-medium tracking-tight truncate">{name}</h5>
      </div>
      {modifiers.length > 0 ? (
        <ul className="mt-1 text-[12px] text-[var(--fg-tertiary)] space-y-0.5">
          {modifiers.map((m) => (
            <li key={m.name} className="flex items-center justify-between gap-2">
              <span className="truncate">+ {m.name}</span>
              <Money minor={m.priceDeltaMinor} currency={currency} mono className="text-[11px]" />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex items-center gap-3">
        <QtyStepper value={qty} onChange={onQtyChange} />
        <Money minor={unitPriceMinor} currency={currency} mono className="text-[12px] text-[var(--fg-muted)]" />
      </div>
      {onNoteChange ? (
        <input
          value={note ?? ""}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Note for the kitchen"
          aria-label={`Note for ${name}`}
          className={cn(
            "mt-2 h-9 w-full px-2.5 text-[13px]",
            "bg-[var(--bg-canvas)] rounded-[var(--radius-2)]",
            "ring-1 ring-[var(--line-subtle)] placeholder:text-[var(--fg-muted)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--accent)]",
          )}
        />
      ) : note ? (
        <p className="mt-1.5 text-[12px] italic text-[var(--status-firing)]">✱ {note}</p>
      ) : null}
    </div>

    <div className="flex flex-col items-end gap-2">
      <Money
        minor={sumMinor(unitPriceMinor, qty, modifiers)}
        currency={currency}
        mono
        className="text-[15px] font-medium"
      />
      {onRemove ? (
        <button
          aria-label="remove line"
          onClick={onRemove}
          className="text-[var(--fg-muted)] hover:text-[var(--status-voided)] transition-colors"
        >
          <Trash2 size={14} />
        </button>
      ) : null}
    </div>
  </div>
);
