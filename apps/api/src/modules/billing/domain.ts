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
  /** dine_in | parcel | zomato | swiggy | other | qr — copied from the order at settle. */
  channel: string;
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
  channel: string;
  settledAt: string;
};

/** Totals for a date range, computed in the database — the list is capped, this is not. */
export type SalesSummary = {
  count: number;
  subtotalMinor: bigint;
  taxTotalMinor: bigint;
  grandTotalMinor: bigint;
  byChannel: Array<{ channel: string; count: number; grandTotalMinor: bigint }>;
  taxBreakdown: Array<{ name: string; rate: number; amountMinor: bigint }>;
};

export { fiscalYearFor } from "@odr/tax";

export const formatInvoiceNumber = (prefix: string, fiscalYear: string, seq: number): string =>
  `${prefix}/${fiscalYear}/${String(seq).padStart(5, "0")}`;

export const minorToMoney = (minor: bigint, currency: Currency): Money =>
  Money.fromMinor(minor, currency);
