import { Hono } from "hono";
import { DomainError } from "@odr/shared";
import type { PrintService } from "./service.ts";

/** NO_PRINTER is a flat 409 by contract, not the nested error envelope. */
const attempt = async (fn: () => Promise<void>) => {
  try {
    await fn();
    return null;
  } catch (err) {
    if (err instanceof DomainError && err.code === "NO_PRINTER") return err;
    throw err;
  }
};

export const buildPrintRoutes = (svc: PrintService) => {
  const r = new Hono();

  r.post("/kots/:id", async (c) => {
    const failed = await attempt(() => svc.printKot(c.req.param("id")));
    return failed ? c.json({ error: "NO_PRINTER" }, 409) : c.body(null, 204);
  });

  r.post("/bills/:id", async (c) => {
    const failed = await attempt(() => svc.printBill(c.req.param("id")));
    return failed ? c.json({ error: "NO_PRINTER" }, 409) : c.body(null, 204);
  });

  r.post("/test", async (c) => {
    const outletId = (await c.req.json().catch(() => ({})))?.outletId;
    if (typeof outletId !== "string" || !outletId) return c.json({ error: "outletId required" }, 400);
    const failed = await attempt(() => svc.testPrint(outletId));
    return failed ? c.json({ error: "NO_PRINTER" }, 409) : c.body(null, 204);
  });

  return r;
};
