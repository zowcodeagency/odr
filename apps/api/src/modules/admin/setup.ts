import { Hono } from "hono";
import { z } from "zod";
import { ConflictError, ValidationError } from "@odr/shared";
import { errorHandler } from "../../middleware/error.ts";
import type { AdminService } from "./service.ts";
import type { AdminRepo } from "./ports.ts";

/*
 * First run of a Box: no admin console on site, so the owner creates the
 * restaurant here. Open only while the database has no tenant; a 409 after
 * that. Mounted only when buildApp is asked for it (never in the cloud).
 */
const schema = z.object({
  name: z.string().trim().min(1).max(80),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  ownerFullName: z.string().trim().min(1),
  gstin: z.string().trim().length(15).optional(),
});

const today = () => new Date().toISOString().slice(0, 10);

export const buildSetupRoutes = (svc: AdminService, repo: Pick<AdminRepo, "listTenants">) => {
  const r = new Hono();
  r.onError(errorHandler);
  const needed = async () => (await repo.listTenants()).length === 0;

  r.get("/setup", async (c) => c.json({ needed: await needed() }));

  r.post("/setup", async (c) => {
    if (!(await needed())) throw new ConflictError("this box is already set up");
    const parsed = schema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("invalid payload", { issues: parsed.error.issues });
    // ponytail: 12 months from today until the license plan replaces this date.
    const res = await svc.createRestaurant({ ...parsed.data, startDate: today(), months: 12 });
    return c.json({ tenantId: res.tenantId, outletId: res.outletId }, 201);
  });
  return r;
};
