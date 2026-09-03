import { Hono } from "hono";
import { z } from "zod";
import { ValidationError } from "@odr/shared";
import { getContext } from "@odr/tenancy";
import type { IdentityService } from "./service.ts";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantId: z.string().uuid().optional(),
});

const staffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  role: z.enum(["owner", "manager", "captain", "cashier", "kitchen"]),
  outletId: z.string().uuid().optional(),
});

const parse = <T>(s: z.ZodSchema<T>, body: unknown): T => {
  const r = s.safeParse(body);
  if (!r.success) throw new ValidationError("invalid payload", { issues: r.error.issues });
  return r.data;
};

export const buildPublicRoutes = (svc: IdentityService) => {
  const r = new Hono();
  r.post("/register", async (c) => {
    const body = parse(registerSchema, await c.req.json());
    const user = await svc.register(body);
    return c.json({ user }, 201);
  });
  r.post("/login", async (c) => {
    const body = parse(loginSchema, await c.req.json());
    const result = await svc.login(body);
    return c.json(result);
  });
  return r;
};

export const buildPrivateRoutes = (svc: IdentityService) => {
  const r = new Hono();
  r.get("/", async (c) => {
    const ctx = getContext();
    const memberships = await svc.listMemberships(ctx.userId);
    return c.json({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      role: ctx.role,
      memberships,
      subscriptionEndsAt: await svc.subscriptionEndsAt(ctx.tenantId),
    });
  });
  return r;
};

export const buildStaffRoutes = (svc: IdentityService) => {
  const r = new Hono();
  r.get("/", async (c) => c.json({ staff: await svc.listStaff() }));
  r.post("/", async (c) => {
    const body = parse(staffSchema, await c.req.json());
    return c.json({ staff: await svc.createStaff(body) }, 201);
  });
  r.delete("/:id", async (c) => {
    await svc.removeStaff(c.req.param("id"));
    return c.body(null, 204);
  });
  return r;
};
