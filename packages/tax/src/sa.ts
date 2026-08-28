import { Money } from "@odr/shared";
import type { TaxStrategy, TaxBreakdown } from "./index.ts";

const RATES: Record<string, number> = {
  VAT_0: 0,
  VAT_15: 0.15,
};

export class SaudiVatStrategy implements TaxStrategy {
  readonly country = "SA";

  classes(): readonly string[] {
    return Object.keys(RATES);
  }

  compute(base: Money, taxClass: string): TaxBreakdown {
    const rate = RATES[taxClass];
    if (rate === undefined) throw new Error(`unknown VAT class: ${taxClass}`);
    const total = base.multiply(rate);
    return { base, components: [{ name: "VAT", rate, amount: total }], total };
  }
}
