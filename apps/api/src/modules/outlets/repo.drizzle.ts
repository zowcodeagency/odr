import { and, eq, sql } from "drizzle-orm";
import type { DB } from "@odr/db";
import { outlets, tables } from "@odr/db/schema";
import type { OutletsRepo } from "./ports.ts";
import type { Outlet, Address } from "./domain.ts";

const toDomain = (r: typeof outlets.$inferSelect): Outlet => ({
  id: r.id,
  name: r.name,
  code: r.code,
  gstin: r.gstin,
  address: r.address as Address,
  invoicePrefix: r.invoicePrefix,
  paperWidth: r.paperWidth,
  printerIp: r.printerIp,
  printerPort: r.printerPort,
  publicToken: r.publicToken,
  upiId: r.upiId,
  isActive: r.isActive,
  menuMode: r.menuMode,
});

export const drizzleOutletsRepo = (db: DB): OutletsRepo => {
  const listTables = (tenantId: string, outletId: string) =>
    db
      .select({ id: tables.id, label: tables.label })
      .from(tables)
      .where(and(eq(tables.tenantId, tenantId), eq(tables.outletId, outletId)))
      .orderBy(tables.label);

  return {
  async list(tenantId) {
    const rows = await db.select().from(outlets).where(eq(outlets.tenantId, tenantId));
    return rows.map(toDomain);
  },

  async byId(tenantId, outletId) {
    const [row] = await db
      .select()
      .from(outlets)
      .where(and(eq(outlets.tenantId, tenantId), eq(outlets.id, outletId)))
      .limit(1);
    return row ? toDomain(row) : null;
  },

  async updateSettings(tenantId, outletId, settings) {
    const [row] = await db
      .update(outlets)
      .set({
        ...(settings.paperWidth !== undefined ? { paperWidth: settings.paperWidth } : {}),
        ...(settings.printerIp !== undefined ? { printerIp: settings.printerIp } : {}),
        ...(settings.printerPort !== undefined ? { printerPort: settings.printerPort } : {}),
        ...(settings.name !== undefined ? { name: settings.name } : {}),
        ...(settings.gstin !== undefined ? { gstin: settings.gstin } : {}),
        ...(settings.address !== undefined ? { address: settings.address } : {}),
        ...(settings.invoicePrefix !== undefined ? { invoicePrefix: settings.invoicePrefix } : {}),
        ...(settings.upiId !== undefined ? { upiId: settings.upiId } : {}),
      })
      .where(and(eq(outlets.tenantId, tenantId), eq(outlets.id, outletId)))
      .returning();
    return row ? toDomain(row) : null;
  },

  async ensurePublicToken(tenantId, outletId, candidate) {
    const [row] = await db
      .update(outlets)
      .set({ publicToken: sql`coalesce(${outlets.publicToken}, ${candidate})` })
      .where(and(eq(outlets.tenantId, tenantId), eq(outlets.id, outletId)))
      .returning({ publicToken: outlets.publicToken });
    return row?.publicToken ?? null;
  },

  listTables,

  async addTables(tenantId, outletId, labels) {
    if (labels.length > 0) {
      await db
        .insert(tables)
        .values(labels.map((label) => ({ tenantId, outletId, label })))
        .onConflictDoNothing({ target: [tables.outletId, tables.label] });
    }
    return listTables(tenantId, outletId);
  },

  async deleteTable(tenantId, tableId) {
    const rows = await db
      .delete(tables)
      .where(and(eq(tables.tenantId, tenantId), eq(tables.id, tableId)))
      .returning({ id: tables.id });
    return rows.length > 0;
  },
  };
};
