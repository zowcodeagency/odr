import { randomBytes } from "node:crypto";
import { ForbiddenError, NotFoundError, ValidationError } from "@odr/shared";
import { can } from "@odr/auth";
import type { EventBus } from "@odr/events";
import { assertOutletScope, getContext } from "@odr/tenancy";
import { isValidGstin, isValidPaperWidth, type Outlet, type OutletSettings } from "./domain.ts";
import type { OutletsRepo } from "./ports.ts";

export type OutletsServiceDeps = { repo: OutletsRepo; events: EventBus };

/** Active outlets first, then by name — the order every picker shows. */
const pickerOrder = (a: Outlet, b: Outlet) =>
  Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name);

export const makeOutletsService = ({ repo, events }: OutletsServiceDeps) => ({
  /** Only what the caller may use: pinned staff get exactly their outlet. */
  async list() {
    const ctx = getContext();
    const rows = await repo.list(ctx.tenantId);
    return rows.filter((o) => !ctx.outletId || o.id === ctx.outletId).sort(pickerOrder);
  },

  async byId(outletId: string) {
    assertOutletScope(outletId);
    return repo.byId(getContext().tenantId, outletId);
  },

  /** Context-free: ordering asks before opening an order, billing events run as system. */
  activeInTenant: async (tenantId: string, outletId: string) =>
    (await repo.byId(tenantId, outletId))?.isActive ?? false,

  async updateSettings(outletId: string, settings: OutletSettings) {
    const ctx = getContext();
    if (!can(ctx.role, "outlet:write")) throw new ForbiddenError("cannot write outlets");
    assertOutletScope(outletId);
    if (settings.paperWidth !== undefined && !isValidPaperWidth(settings.paperWidth)) {
      throw new ValidationError("paperWidth must be 58 or 80", { paperWidth: settings.paperWidth });
    }
    if (settings.gstin && !isValidGstin(settings.gstin)) {
      throw new ValidationError("invalid GSTIN", { gstin: settings.gstin });
    }
    const outlet = await repo.updateSettings(ctx.tenantId, outletId, settings);
    if (!outlet) throw new NotFoundError("outlet", outletId);
    return outlet;
  },

  /** Idempotent: the QR codes already printed keep working. */
  async ensurePublicToken(outletId: string) {
    const ctx = getContext();
    if (!can(ctx.role, "outlet:write")) throw new ForbiddenError("cannot write outlets");
    assertOutletScope(outletId);
    const token = await repo.ensurePublicToken(ctx.tenantId, outletId, randomBytes(16).toString("hex"));
    if (!token) throw new NotFoundError("outlet", outletId);
    return token;
  },

  async listTables(outletId: string) {
    assertOutletScope(outletId);
    return repo.listTables(getContext().tenantId, outletId);
  },

  async addTables(outletId: string, labels: string[]) {
    const ctx = getContext();
    if (!can(ctx.role, "outlet:write")) throw new ForbiddenError("cannot write tables");
    assertOutletScope(outletId);
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
