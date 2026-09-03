import { Hono } from "hono";
import { z } from "zod";
import { ValidationError } from "@odr/shared";
import type { BillingService } from "./service.ts";
import type { Bill } from "./domain.ts";

const settleSchema = z.object({
  orderId: z.string().uuid(),
  // Optional — most walk-ins give nothing. Kept loose on purpose: Indian
  // numbers get written +91, with spaces, or as ten bare digits.
  customerName: z.string().trim().min(1).max(80).optional(),
  customerPhone: z.string().trim().min(6).max(20).optional(),
});

const parse = <S extends z.ZodTypeAny>(s: S, body: unknown): z.infer<S> => {
  const r = s.safeParse(body);
  if (!r.success) throw new ValidationError("invalid payload", { issues: r.error.issues });
  return r.data;
};

const serializeSummary = (b: {
  id: string; outletId: string; orderId: string; invoiceNumber: string; currency: string;
  grandTotalMinor: bigint; customerName: string | null; customerPhone: string | null; settledAt: string;
}) => ({ ...b, grandTotalMinor: b.grandTotalMinor.toString() });

const serialize = (b: Bill) => ({
  ...b,
  subtotalMinor: b.subtotalMinor.toString(),
  taxTotalMinor: b.taxTotalMinor.toString(),
  grandTotalMinor: b.grandTotalMinor.toString(),
  lines: b.lines.map((l) => ({
    ...l,
    unitPriceMinor: l.unitPriceMinor.toString(),
    lineSubtotalMinor: l.lineSubtotalMinor.toString(),
    lineTaxMinor: l.lineTaxMinor.toString(),
  })),
});

export const buildBillingRoutes = (svc: BillingService) => {
  const r = new Hono();

  r.post("/bills", async (c) => {
    const body = parse(settleSchema, await c.req.json());
    const bill = await svc.settleOrderToBill(body);
    return c.json({ bill: serialize(bill) }, 201);
  });

  // Must be registered before /bills/:id or "bills" would match the param.
  r.get("/bills", async (c) => {
    const bills = await svc.list({
      ...(c.req.query("outletId") ? { outletId: c.req.query("outletId")! } : {}),
      ...(c.req.query("from") ? { from: c.req.query("from")! } : {}),
      ...(c.req.query("to") ? { to: c.req.query("to")! } : {}),
    });
    return c.json({ bills: bills.map(serializeSummary) });
  });

  r.get("/bills/:id", async (c) => {
    const b = await svc.byId(c.req.param("id"));
    if (!b) return c.json({ error: { code: "NOT_FOUND", message: "bill not found" } }, 404);
    return c.json({ bill: serialize(b) });
  });

  return r;
};
