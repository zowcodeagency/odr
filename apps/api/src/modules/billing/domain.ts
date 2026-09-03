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
};

/**
 * Indian fiscal year: 1 April → 31 March (e.g. "2026-27" runs 2026-04-01..2027-03-31).
 * Returns the year-of-service for invoice numbering. Saudi (and most others)
 * follow calendar year — call this with country="SA" to get e.g. "2026".
 */
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

export const fiscalYearFor = (date: Date, country: string): string => {
  const y = date.getUTCFullYear();
  if (country === "IN") {
    const aprilOrLater = date.getUTCMonth() >= 3;
    const start = aprilOrLater ? y : y - 1;
    const end = (start + 1) % 100;
    return `${start}-${String(end).padStart(2, "0")}`;
  }
  return String(y);
};

export const formatInvoiceNumber = (prefix: string, fiscalYear: string, seq: number): string =>
  `${prefix}/${fiscalYear}/${String(seq).padStart(5, "0")}`;

export const minorToMoney = (minor: bigint, currency: Currency): Money =>
  Money.fromMinor(minor, currency);
