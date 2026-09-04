import { Money } from "@odr/shared";

export type TaxBreakdown = {
  base: Money;
  components: Array<{ name: string; rate: number; amount: Money }>;
  total: Money;
};

export interface TaxStrategy {
  readonly country: string;
  compute(base: Money, taxClass: string, opts: { interstate?: boolean }): TaxBreakdown;
  classes(): readonly string[];
}

export { IndiaGstStrategy } from "./in.ts";
export { SaudiVatStrategy } from "./sa.ts";

import { IndiaGstStrategy } from "./in.ts";
import { SaudiVatStrategy } from "./sa.ts";

const registry: Record<string, TaxStrategy> = {
  IN: new IndiaGstStrategy(),
  SA: new SaudiVatStrategy(),
};

/**
 * Indian fiscal year: 1 April → 31 March ("2026-27" runs 2026-04-01..2027-03-31).
 * Saudi and most others follow the calendar year ("2026").
 */
export const fiscalYearFor = (date: Date, country: string): string => {
  const y = date.getUTCFullYear();
  if (country === "IN") {
    const start = date.getUTCMonth() >= 3 ? y : y - 1;
    return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
  }
  return String(y);
};

export const getTaxStrategy = (country: string): TaxStrategy => {
  const s = registry[country];
  if (!s) throw new Error(`no tax strategy for country ${country}`);
  return s;
};
