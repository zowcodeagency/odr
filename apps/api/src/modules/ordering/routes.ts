import { Hono } from "hono";
import { z } from "zod";
import { ValidationError } from "@odr/shared";
import type { OrderingService } from "./service.ts";
import { ORDER_CHANNELS, orderTotalMinor, requiresTable, type Order } from "./domain.ts";

const openSchema = z
  .object({
    outletId: z.string().uuid(),
    tableLabel: z.string().min(1).optional(),
    channel: z.enum(ORDER_CHANNELS).default("dine_in"),
    customerName: z.string().min(1).optional(),
    aggregatorRef: z.string().min(1).optional(),
  })
  .refine((v) => !requiresTable(v.channel) || !!v.tableLabel, {
    message: "tableLabel is required for dine_in orders",
    path: ["tableLabel"],
  });

const lineSchema = z.object({
  itemId: z.string().uuid(),
  itemName: z.string().min(1),
  qty: z.number().int().positive(),
  unitPriceMinor: z.union([z.string(), z.number()]).transform((v) => BigInt(v)),
  taxClass: z.string().min(1),
  note: z.string().min(1).optional(),
  modifiers: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    priceDeltaMinor: z.union([z.string(), z.number()]).transform((v) => BigInt(v)),
  })).default([]),
});

const addItemsSchema = z.object({ lines: z.array(lineSchema).min(1) });
const settleSchema = z.object({ localBill: z.boolean().optional() });

const parse = <S extends z.ZodTypeAny>(s: S, body: unknown): z.infer<S> => {
  const r = s.safeParse(body);
  if (!r.success) throw new ValidationError("invalid payload", { issues: r.error.issues });
  return r.data;
};

const serialize = (o: unknown): unknown => JSON.parse(JSON.stringify(o, (_k, v) => typeof v === "bigint" ? v.toString() : v));

/** Frozen list shape — the captain PWA's tables screen reads exactly these keys. */
const listView = (o: Order) => ({
  id: o.id,
  tableLabel: o.tableLabel,
  channel: o.channel,
  customerName: o.customerName ?? null,
  aggregatorRef: o.aggregatorRef ?? null,
  status: o.state,
  totalMinor: orderTotalMinor(o.lines).toString(),
  lineCount: o.lines.length,
  createdAt: o.openedAt,
});

export const buildOrderingRoutes = (svc: OrderingService) => {
  const r = new Hono();

  r.post("/orders", async (c) => {
    const body = parse(openSchema, await c.req.json());
    return c.json({ order: serialize(await svc.openTable(body)) }, 201);
  });

  r.get("/orders", async (c) => {
    const outletId = c.req.query("outletId");
    if (!outletId) throw new ValidationError("outletId required");
    return c.json({ orders: (await svc.listOpen(outletId)).map(listView) });
  });

  r.get("/orders/:id", async (c) => {
    const o = await svc.byId(c.req.param("id"));
    if (!o) return c.json({ error: { code: "NOT_FOUND", message: "order not found" } }, 404);
    return c.json({ order: serialize(o) });
  });

  r.post("/orders/:id/items", async (c) => {
    const body = parse(addItemsSchema, await c.req.json());
    const updated = await svc.addItems({ orderId: c.req.param("id"), lines: body.lines });
    return c.json({ order: serialize(updated) });
  });

  r.post("/orders/:id/fire-kot", async (c) =>
    c.json({ order: serialize(await svc.fireKot({ orderId: c.req.param("id") })) }));

  r.post("/orders/:id/settle", async (c) => {
    // Body is optional — the plain settle sends none.
    const body = parse(settleSchema, await c.req.json().catch(() => ({})));
    return c.json({ order: serialize(await svc.settle({ orderId: c.req.param("id"), ...body })) });
  });

  r.delete("/orders/:id", async (c) => {
    await svc.forget({ orderId: c.req.param("id") });
    return c.body(null, 204);
  });

  r.post("/orders/:id/void", async (c) =>
    c.json({ order: serialize(await svc.void({ orderId: c.req.param("id") })) }));

  r.get("/kots", async (c) => {
    const outletId = c.req.query("outletId");
    if (!outletId) throw new ValidationError("outletId required");
    return c.json({ kots: await svc.listPendingKots(outletId) });
  });

  r.post("/kots/:id/done", async (c) => c.json({ kot: await svc.kotDone({ kotId: c.req.param("id") }) }));

  return r;
};
