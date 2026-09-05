import { Hono } from "hono";
import { z } from "zod";
import { ValidationError } from "@odr/shared";
import type { OutletsService } from "./service.ts";
import { PAPER_WIDTHS } from "./domain.ts";

const addressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(1),
  country: z.string().min(2).max(2),
});

const settingsSchema = z
  .object({
    paperWidth: z.union([z.literal(PAPER_WIDTHS[0]), z.literal(PAPER_WIDTHS[1])]),
    // null clears the printer (back to browser-print only).
    printerIp: z.string().min(1).max(255).nullable(),
    printerPort: z.number().int().min(1).max(65535),
    name: z.string().trim().min(1).max(80),
    gstin: z.string().trim().min(1).max(15).nullable(),
    address: addressSchema,
    invoicePrefix: z.string().trim().min(1).max(8),
    // null removes the payment QR from the bill.
    upiId: z.string().trim().min(3).max(100).nullable(),
  })
  .partial()
  .refine((p) => Object.keys(p).length > 0, "nothing to update");

const tablesSchema = z.object({ labels: z.array(z.string().min(1).max(32)).min(1).max(200) });

const parse = <S extends z.ZodTypeAny>(s: S, body: unknown): z.infer<S> => {
  const r = s.safeParse(body);
  if (!r.success) throw new ValidationError("invalid payload", { issues: r.error.issues });
  return r.data;
};

export const buildOutletsRoutes = (svc: OutletsService) => {
  const r = new Hono();
  r.get("/", async (c) => c.json({ outlets: await svc.list() }));

  r.patch("/:id", async (c) => {
    const body = parse(settingsSchema, await c.req.json());
    return c.json({ outlet: await svc.updateSettings(c.req.param("id"), body) });
  });

  r.post("/:id/qr-token", async (c) =>
    c.json({ publicToken: await svc.ensurePublicToken(c.req.param("id")) }));

  r.get("/:outletId/tables", async (c) =>
    c.json({ tables: await svc.listTables(c.req.param("outletId")) }));

  r.post("/:outletId/tables", async (c) => {
    const body = parse(tablesSchema, await c.req.json());
    return c.json({ tables: await svc.addTables(c.req.param("outletId"), body.labels) }, 201);
  });

  return r;
};

/** Mounted at /api/v1/tables — table ids are globally unique, no outlet in the path. */
export const buildTablesRoutes = (svc: OutletsService) => {
  const r = new Hono();
  r.delete("/:id", async (c) => {
    await svc.deleteTable(c.req.param("id"));
    return c.body(null, 204);
  });
  return r;
};
