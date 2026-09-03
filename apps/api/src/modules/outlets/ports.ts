import type { Outlet, Table, OutletSettings } from "./domain.ts";

export interface OutletsRepo {
  list(tenantId: string): Promise<Outlet[]>;
  byId(tenantId: string, outletId: string): Promise<Outlet | null>;
  updateSettings(tenantId: string, outletId: string, settings: OutletSettings): Promise<Outlet | null>;
  /** Get-or-create in one statement — returns the existing token when there is one. */
  ensurePublicToken(tenantId: string, outletId: string, candidate: string): Promise<string | null>;

  listTables(tenantId: string, outletId: string): Promise<Table[]>;
  /** Idempotent by (outlet, label) — re-posting the same labels is a no-op. */
  addTables(tenantId: string, outletId: string, labels: string[]): Promise<Table[]>;
  deleteTable(tenantId: string, tableId: string): Promise<boolean>;
}
