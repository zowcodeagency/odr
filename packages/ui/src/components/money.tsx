import { type HTMLAttributes } from "react";
import { cn } from "../lib/cn.ts";
import { formatMinor, type Currency } from "../lib/money.ts";

export interface MoneyProps extends HTMLAttributes<HTMLSpanElement> {
  minor: bigint | string | number;
  currency?: Currency;
  withSymbol?: boolean;
  /** When true, render in mono — for receipt/total contexts. */
  mono?: boolean;
}

export const Money = ({
  minor,
  currency = "INR",
  withSymbol = true,
  mono = false,
  className,
  ...rest
}: MoneyProps) => (
  <span
    className={cn(
      "tabular-nums",
      mono && "font-mono tracking-[-0.01em]",
      className,
    )}
    {...rest}
  >
    {formatMinor(minor, currency, { withSymbol })}
  </span>
);
