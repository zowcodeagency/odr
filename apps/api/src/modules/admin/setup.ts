import { Hono } from "hono";
import { z } from "zod";
import { ConflictError, ForbiddenError, ValidationError } from "@odr/shared";
import { errorHandler } from "../../middleware/error.ts";
import type { AdminService } from "./service.ts";
import type { AdminRepo } from "./ports.ts";

/*
 * First run of a Box: no admin console on site, so the owner creates the
 * restaurant here. Open only while the database has no tenant; a 409 after
 * that. Mounted only when buildApp is asked for it (never in the cloud).
 * `code` is the six-digit setup code printed on the Box's own console —
 * proof the caller is standing in front of the machine, not on the wifi.
 */
const schema = z.object({
  name: z.string().trim().min(1).max(80),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  ownerFullName: z.string().trim().min(1),
  gstin: z.string().trim().length(15).optional(),
  setupCode: z.string().length(6),
});

const today = () => new Date().toISOString().slice(0, 10);

export const buildSetupRoutes = (svc: AdminService, repo: Pick<AdminRepo, "listTenants">, code: string) => {
  const r = new Hono();
  // Kept despite the parent app's own handler: setup.test.ts exercises this router
  // standalone (not mounted), where an unhandled throw falls through to Hono's
  // default 500 instead of the 403/409 this module's contract requires.
  r.onError(errorHandler);
  const needed = async () => (await repo.listTenants()).length === 0;
  // ponytail: in-memory, single process, resets on restart — five wrong
  // guesses locks /setup until the Box restarts. No IP/rate-limit table.
  let failures = 0;

  r.get("/setup", async (c) => c.json({ needed: await needed() }));

  r.post("/setup", async (c) => {
    if (!(await needed())) throw new ConflictError("this box is already set up");
    const parsed = schema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("invalid payload", { issues: parsed.error.issues });
    if (failures >= 5) throw new ForbiddenError("too many wrong setup codes — restart the box to try again");
    if (parsed.data.setupCode !== code) {
      failures++;
      throw new ForbiddenError("wrong setup code");
    }
    // ponytail: 12 months from today until the license plan replaces this date.
    const res = await svc.createRestaurant({ ...parsed.data, startDate: today(), months: 12 });
    return c.json({ tenantId: res.tenantId, outletId: res.outletId }, 201);
  });
  return r;
};
