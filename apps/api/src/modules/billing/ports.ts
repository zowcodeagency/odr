import type { Bill, BillLine, BillSummary, SalesSummary } from "./domain.ts";

export type BillInsert = {
  id: string;
  tenantId: string;
  outletId: string;
  orderId: string;
  /** Empty = reserve the next number from the outlet counter; set = a device-issued number, stored as-is. */
  invoiceNumber: string;
  fiscalYear: string;
  /** Defaults to now; a device-side bill carries the moment it was printed. */
  settledAt?: string;
  currency: string;
  subtotalMinor: bigint;
  taxTotalMinor: bigint;
  grandTotalMinor: bigint;
  taxBreakdown: Array<{ name: string; rate: number; amountMinor: string }>;
  customerName?: string | null;
  customerPhone?: string | null;
  channel: string;
  lines: Array<Omit<BillLine, "id"> & { id?: string }>;
};

export interface BillingRepo {
  /**
   * Atomically reserve and return the next sequential invoice number for
   * (outletId, fiscalYear). Implementations must guarantee gap-free
   * monotonic sequencing — typically via SELECT … FOR UPDATE on the
   * outlets row inside the same tx as the bill insert.
   */
  reserveAndCreate(input: BillInsert, prefix: string): Promise<Bill>;

  byId(tenantId: string, id: string): Promise<Bill | null>;
  /** Invoices for one outlet, or every outlet when omitted, newest first. `from`/`to` are ISO instants. */
  list(tenantId: string, opts: { outletId?: string; from?: string; to?: string; limit: number }): Promise<BillSummary[]>;
  /** Range totals with per-channel and per-tax-component rows. Same filters as list. */
  summary(tenantId: string, opts: { outletId?: string; from?: string; to?: string }): Promise<SalesSummary>;
  byOrderId(tenantId: string, orderId: string): Promise<Bill | null>;
  /** Fills in customer details on an already-created bill. */
  setCustomer(tenantId: string, billId: string, c: { customerName: string | null; customerPhone: string | null }): Promise<Bill | null>;

  /** Returns the outlet's invoice prefix and currency for a tenant-scoped lookup. */
  outletPrefixAndCurrency(tenantId: string, outletId: string): Promise<{ prefix: string; currency: string } | null>;
}
