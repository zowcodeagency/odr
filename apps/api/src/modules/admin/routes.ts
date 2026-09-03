import { createHash, timingSafeEqual } from "node:crypto";
import { Hono, type MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { ValidationError } from "@odr/shared";
import type { AdminService } from "./service.ts";
import { parseCsvMenu, parseJsonMenu } from "./domain.ts";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const rupees = z.union([z.number().positive(), z.string().regex(/^\d+(\.\d{1,2})?$/)]);

const createRestaurantSchema = z.object({
  name: z.string().min(1),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  ownerFullName: z.string().min(1),
  startDate: isoDate,
  months: z.number().int().min(1),
  gstin: z.string().min(1).optional(),
});

const topupSchema = z.object({
  amount: rupees,
  monthsAdded: z.number().int().min(1),
  note: z.string().optional(),
});

const addressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(3),
  country: z.string().length(2),
});

const createOutletSchema = z.object({
  name: z.string().trim().min(1).max(80),
  gstin: z.string().length(15).optional(),
  address: addressSchema,
  invoicePrefix: z.string().trim().min(1).max(8).optional(),
  menuMode: z.enum(["shared", "own"]),
});

const patchOutletSchema = z.object({ isActive: z.boolean() });

const importSchema = z
  .union([
    z.object({
      categories: z.array(
        z.object({
          name: z.string().min(1),
          items: z.array(
            z.object({
              name: z.string().min(1),
              price: z.union([z.number(), z.string()]),
              taxClass: z.string().optional(),
              isVeg: z.boolean().optional(),
              description: z.string().optional(),
            }),
          ),
        }),
      ),
    }),
    z.object({ csv: z.string().min(1) }),
  ])
  .and(z.object({ outletId: z.string().uuid().optional() }));

const parse = <S extends z.ZodTypeAny>(s: S, body: unknown): z.infer<S> => {
  const r = s.safeParse(body);
  if (!r.success) throw new ValidationError("invalid payload", { issues: r.error.issues });
  return r.data;
};

// Hash both sides so the compare is constant-time *and* length-safe
// (timingSafeEqual throws on unequal buffer lengths).
const sha = (s: string) => createHash("sha256").update(s).digest();
const secretEquals = (a: string, b: string) => timingSafeEqual(sha(a), sha(b));

const adminAuth: MiddlewareHandler = async (c, next) => {
  const key = process.env.ADMIN_KEY;
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!token) return c.json({ error: "UNAUTHORIZED" }, 401);
  // Machine path: the shared ADMIN_KEY (scripts, curl, emergencies).
  if (key && secretEquals(token, key)) return next();
  // Human path: a Supabase Auth access token — team accounts are created by
  // hand in the Supabase dashboard. Validated by asking Supabase, so no JWT
  // key material lives here. ponytail: one Supabase round-trip per admin
  // request — cache the verdict if the console ever feels slow.
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (url && anon) {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anon, authorization: `Bearer ${token}` },
    });
    if (r.ok) return next();
  }
  return c.json({ error: "UNAUTHORIZED" }, 401);
};

export const buildAdminRoutes = (svc: AdminService) => {
  const r = new Hono();

  // The internal admin UI runs on :3002 and calls this API directly.
  r.use("*", cors({ origin: "http://localhost:3002", allowHeaders: ["authorization", "content-type"] }));
  r.use("*", adminAuth);

  r.post("/restaurants", async (c) => {
    const body = parse(createRestaurantSchema, await c.req.json());
    return c.json(await svc.createRestaurant(body), 201);
  });

  r.get("/restaurants", async (c) => c.json({ restaurants: await svc.listRestaurants() }));

  r.post("/restaurants/:tenantId/topups", async (c) => {
    const body = parse(topupSchema, await c.req.json());
    return c.json(await svc.addTopup(c.req.param("tenantId"), body), 201);
  });

  r.get("/restaurants/:tenantId/topups", async (c) =>
    c.json({ topups: await svc.listTopups(c.req.param("tenantId")) }));

  r.get("/restaurants/:tenantId/outlets", async (c) =>
    c.json({ outlets: await svc.listOutlets(c.req.param("tenantId")) }));

  r.post("/restaurants/:tenantId/outlets", async (c) => {
    const body = parse(createOutletSchema, await c.req.json());
    return c.json(await svc.createOutlet(c.req.param("tenantId"), body), 201);
  });

  r.patch("/restaurants/:tenantId/outlets/:outletId", async (c) => {
    const body = parse(patchOutletSchema, await c.req.json());
    return c.json(await svc.setOutletActive(c.req.param("tenantId"), c.req.param("outletId"), body.isActive));
  });

  r.post("/restaurants/:tenantId/menu/import", async (c) => {
    const body = parse(importSchema, await c.req.json());
    const categories = "csv" in body ? parseCsvMenu(body.csv) : parseJsonMenu(body.categories);
    return c.json(await svc.importMenu(c.req.param("tenantId"), categories, body.outletId), 201);
  });

  return r;
};
