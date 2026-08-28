import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { ValidationError } from "@odr/shared";
import type { PublicService } from "./service.ts";

const orderSchema = z.object({
  token: z.string().min(1),
  tableLabel: z.string().min(1).max(32),
  customerName: z.string().min(1).max(80).optional(),
  // No prices here on purpose — the server prices every line from the menu.
  lines: z.array(z.object({
    itemId: z.string().uuid(),
    qty: z.number().int().positive().max(99),
    note: z.string().max(140).optional(),
  })).min(1).max(50),
});

const parse = <S extends z.ZodTypeAny>(s: S, body: unknown): z.infer<S> => {
  const r = s.safeParse(body);
  if (!r.success) throw new ValidationError("invalid payload", { issues: r.error.issues });
  return r.data;
};

const requireToken = (t: string | undefined): string => {
  if (!t) throw new ValidationError("token required");
  return t;
};

// ponytail: per-outlet sliding window in process memory — resets on restart and
// is per-instance, which is fine while we run one API process. Move to Redis
// (REDIS_URL is already in .env) the day we run two.
const WINDOW_MS = 60_000;
const MAX_ORDERS_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

const rateLimited = (outletId: string): boolean => {
  const now = Date.now();
  const recent = (hits.get(outletId) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.set(outletId, recent);
  if (recent.length >= MAX_ORDERS_PER_WINDOW) return true;
  recent.push(now);
  return false;
};

export const buildPublicRoutes = (svc: PublicService) => {
  const r = new Hono();

  // Diners arrive from a QR code on any device/origin.
  r.use("*", cors({ origin: "*", allowHeaders: ["content-type"] }));

  r.get("/outlets/:outletId/menu", async (c) =>
    c.json(await svc.menu(c.req.param("outletId"), requireToken(c.req.query("token")))));

  // Dish photos — <img> tags can't send auth headers, and diners see these
  // anyway, so the bytes are public. Ids are unguessable UUIDs.
  r.get("/menu-images/:id", async (c) => {
    const img = await svc.itemImage(c.req.param("id"));
    if (!img) return c.notFound();
    const bytes = Uint8Array.from(atob(img.data), (ch) => ch.charCodeAt(0));
    return c.body(bytes.buffer as ArrayBuffer, 200, {
      "content-type": img.type,
      "cache-control": "public, max-age=300",
    });
  });

  r.post("/outlets/:outletId/orders", async (c) => {
    const outletId = c.req.param("outletId");
    if (rateLimited(outletId)) return c.json({ error: "RATE_LIMITED" }, 429);
    const body = parse(orderSchema, await c.req.json());
    return c.json(await svc.placeOrder(outletId, body), 201);
  });

  r.get("/orders/:id", async (c) =>
    c.json(await svc.orderStatus(c.req.param("id"), requireToken(c.req.query("token")))));

  return r;
};
