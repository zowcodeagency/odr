import { Money } from "@odr/shared";
import type { TaxStrategy, TaxBreakdown } from "./index.ts";

const RATES: Record<string, number> = {
  GST_0: 0,
  GST_5: 0.05,
  GST_12: 0.12,
  GST_18: 0.18,
  GST_28: 0.28,
};

export class IndiaGstStrategy implements TaxStrategy {
  readonly country = "IN";

  classes(): readonly string[] {
    return Object.keys(RATES);
  }

  compute(base: Money, taxClass: string, opts: { interstate?: boolean }): TaxBreakdown {
    const rate = RATES[taxClass];
    if (rate === undefined) throw new Error(`unknown GST class: ${taxClass}`);
    const total = base.multiply(rate);
    const components = opts.interstate
      ? [{ name: "IGST", rate, amount: total }]
      : [
          { name: "CGST", rate: rate / 2, amount: total.multiply(0.5) },
          { name: "SGST", rate: rate / 2, amount: total.multiply(0.5) },
        ];
    return { base, components, total };
  }
}
