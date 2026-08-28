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

export const getTaxStrategy = (country: string): TaxStrategy => {
  const s = registry[country];
  if (!s) throw new Error(`no tax strategy for country ${country}`);
  return s;
};
