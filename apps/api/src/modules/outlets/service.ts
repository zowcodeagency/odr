import { randomBytes } from "node:crypto";
import { ForbiddenError, NotFoundError, ValidationError } from "@odr/shared";
import { can } from "@odr/auth";
import type { EventBus } from "@odr/events";
import { getContext } from "@odr/tenancy";
import { isValidGstin, isValidPaperWidth, type Address, type OutletSettings } from "./domain.ts";
import type { OutletsRepo } from "./ports.ts";

export type OutletsServiceDeps = { repo: OutletsRepo; events: EventBus };

export const makeOutletsService = ({ repo, events }: OutletsServiceDeps) => ({
  list: () => repo.list(getContext().tenantId),

  byId: (outletId: string) => repo.byId(getContext().tenantId, outletId),

  async create(input: { name: string; code: string; gstin?: string; address: Address; invoicePrefix?: string }) {
    const ctx = getContext();
    if (!can(ctx.role, "outlet:write")) throw new ForbiddenError("cannot write outlets");
    if (input.gstin && !isValidGstin(input.gstin)) {
      throw new ValidationError("invalid GSTIN", { gstin: input.gstin });
    }
    const outlet = await repo.create(ctx.tenantId, input);
    await events.publish({
      name: "outlet.created",
      tenantId: ctx.tenantId,
      occurredAt: new Date().toISOString(),
      payload: outlet,
    });
    return outlet;
  },

  async updateSettings(outletId: string, settings: OutletSettings) {
    const ctx = getContext();
    if (!can(ctx.role, "outlet:write")) throw new ForbiddenError("cannot write outlets");
    if (settings.paperWidth !== undefined && !isValidPaperWidth(settings.paperWidth)) {
      throw new ValidationError("paperWidth must be 58 or 80", { paperWidth: settings.paperWidth });
    }
    const outlet = await repo.updateSettings(ctx.tenantId, outletId, settings);
    if (!outlet) throw new NotFoundError("outlet", outletId);
    return outlet;
  },

  /** Idempotent: the QR codes already printed keep working. */
  async ensurePublicToken(outletId: string) {
    const ctx = getContext();
    if (!can(ctx.role, "outlet:write")) throw new ForbiddenError("cannot write outlets");
    const token = await repo.ensurePublicToken(ctx.tenantId, outletId, randomBytes(16).toString("hex"));
    if (!token) throw new NotFoundError("outlet", outletId);
    return token;
  },

  listTables: (outletId: string) => repo.listTables(getContext().tenantId, outletId),

  async addTables(outletId: string, labels: string[]) {
    const ctx = getContext();
    if (!can(ctx.role, "outlet:write")) throw new ForbiddenError("cannot write tables");
    if (!(await repo.byId(ctx.tenantId, outletId))) throw new NotFoundError("outlet", outletId);
    return repo.addTables(ctx.tenantId, outletId, [...new Set(labels.map((l) => l.trim()))].filter(Boolean));
  },

  async deleteTable(tableId: string) {
    const ctx = getContext();
    if (!can(ctx.role, "outlet:write")) throw new ForbiddenError("cannot delete tables");
    if (!(await repo.deleteTable(ctx.tenantId, tableId))) throw new NotFoundError("table", tableId);
  },
});

export type OutletsService = ReturnType<typeof makeOutletsService>;
