import type { Bill, BillLine, BillSummary } from "./domain.ts";

export type BillInsert = {
  id: string;
  tenantId: string;
  outletId: string;
  orderId: string;
  invoiceNumber: string;
  fiscalYear: string;
  currency: string;
  subtotalMinor: bigint;
  taxTotalMinor: bigint;
  grandTotalMinor: bigint;
  taxBreakdown: Array<{ name: string; rate: number; amountMinor: string }>;
  customerName?: string | null;
  customerPhone?: string | null;
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
  byOrderId(tenantId: string, orderId: string): Promise<Bill | null>;
  /** Fills in customer details on an already-created bill. */
  setCustomer(tenantId: string, billId: string, c: { customerName: string | null; customerPhone: string | null }): Promise<Bill | null>;

  /** Returns the outlet's invoice prefix and currency for a tenant-scoped lookup. */
  outletPrefixAndCurrency(tenantId: string, outletId: string): Promise<{ prefix: string; currency: string } | null>;
}
