import { test, expect } from "bun:test";
import { Money } from "@odr/shared";
import { getTaxStrategy } from "./index.ts";

test("IN GST_5 intrastate splits CGST+SGST", () => {
  const tax = getTaxStrategy("IN");
  const r = tax.compute(Money.of(100, "INR"), "GST_5", { interstate: false });
  expect(r.components.map((c) => c.name).sort()).toEqual(["CGST", "SGST"]);
  expect(r.total.toMajor()).toBe("5.00");
});

test("IN GST_18 interstate is single IGST", () => {
  const tax = getTaxStrategy("IN");
  const r = tax.compute(Money.of(200, "INR"), "GST_18", { interstate: true });
  expect(r.components).toHaveLength(1);
  expect(r.components[0]!.name).toBe("IGST");
  expect(r.total.toMajor()).toBe("36.00");
});

test("SA VAT_15 single component", () => {
  const tax = getTaxStrategy("SA");
  const r = tax.compute(Money.of(100, "SAR"), "VAT_15", {});
  expect(r.components).toHaveLength(1);
  expect(r.components[0]!.name).toBe("VAT");
  expect(r.total.toMajor()).toBe("15.00");
});
