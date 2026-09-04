import { Money, type Currency } from "@odr/shared";

export type BillLine = {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  unitPriceMinor: bigint;
  taxClass: string;
  lineSubtotalMinor: bigint;
  lineTaxMinor: bigint;
};

export type TaxComponentSnapshot = {
  name: string;
  rate: number;
  amountMinor: string;
};

export type Bill = {
  id: string;
  outletId: string;
  orderId: string;
  invoiceNumber: string;
  fiscalYear: string;
  currency: Currency;
  subtotalMinor: bigint;
  taxTotalMinor: bigint;
  grandTotalMinor: bigint;
  taxBreakdown: TaxComponentSnapshot[];
  customerName: string | null;
  customerPhone: string | null;
  settledAt: string;
  lines: BillLine[];
  /** From the order it settled — saves the bill screen a second round trip. */
  tableLabel?: string | null;
};

/** Row shape for the invoice list — no lines, so one query serves the page. */
export type BillSummary = {
  id: string;
  outletId: string;
  orderId: string;
  invoiceNumber: string;
  currency: Currency;
  grandTotalMinor: bigint;
  customerName: string | null;
  customerPhone: string | null;
  settledAt: string;
};

export { fiscalYearFor } from "@odr/tax";

export const formatInvoiceNumber = (prefix: string, fiscalYear: string, seq: number): string =>
  `${prefix}/${fiscalYear}/${String(seq).padStart(5, "0")}`;

export const minorToMoney = (minor: bigint, currency: Currency): Money =>
  Money.fromMinor(minor, currency);
