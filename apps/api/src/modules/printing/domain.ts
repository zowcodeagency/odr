import { Money, type Currency } from "@odr/shared";
import type { Receipt, ReceiptLine } from "@odr/printing";

/** Printable columns for the two roll sizes restaurants actually own. */
export const columnsFor = (paperWidthMm: number): number => (paperWidthMm === 58 ? 32 : 48);

const text = (t: string, opts: { bold?: boolean; align?: "left" | "center" | "right" } = {}): ReceiptLine =>
  ({ kind: "text", text: t, ...opts });

const rule = (cols: number): ReceiptLine => text("-".repeat(cols));

/** "2 x Masala Dosa            240.00" — right-aligned amount, truncated name. */
const row = (left: string, right: string, cols: number): ReceiptLine => {
  const room = Math.max(1, cols - right.length - 1);
  const l = left.length > room ? left.slice(0, room - 1) + "…" : left.padEnd(room);
  return text(`${l} ${right}`);
};

export type KotPrintData = {
  number: number;
  tableLabel: string | null;
  channel: string;
  firedAt: string;
  lines: Array<{ itemName: string; qty: number; note: string | null }>;
};

export const kotReceipt = (outletName: string, kot: KotPrintData, cols: number): Receipt => ({
  header: [
    text(outletName, { bold: true, align: "center" }),
    text(`KOT #${kot.number}`, { bold: true, align: "center" }),
    text(kot.tableLabel ? `Table ${kot.tableLabel}` : kot.channel.toUpperCase(), { align: "center" }),
    text(new Date(kot.firedAt).toLocaleString("en-IN"), { align: "center" }),
    rule(cols),
  ],
  body: kot.lines.flatMap((l) => [
    text(`${l.qty} x ${l.itemName}`, { bold: true }),
    ...(l.note ? [text(`    * ${l.note}`)] : []),
  ]),
  footer: [rule(cols)],
});

export type BillPrintData = {
  invoiceNumber: string;
  currency: Currency;
  subtotalMinor: bigint;
  taxTotalMinor: bigint;
  grandTotalMinor: bigint;
  taxBreakdown: Array<{ name: string; rate: number; amountMinor: string }>;
  settledAt: string;
  lines: Array<{ itemName: string; qty: number; unitPriceMinor: bigint; lineSubtotalMinor: bigint }>;
};

export const billReceipt = (
  outlet: { name: string; gstin: string | null },
  bill: BillPrintData,
  cols: number,
): Receipt => {
  const money = (m: bigint) => Money.fromMinor(m, bill.currency).toMajor();
  return {
    header: [
      text(outlet.name, { bold: true, align: "center" }),
      ...(outlet.gstin ? [text(`GSTIN ${outlet.gstin}`, { align: "center" })] : []),
      text(bill.invoiceNumber, { align: "center" }),
      text(new Date(bill.settledAt).toLocaleString("en-IN"), { align: "center" }),
      rule(cols),
    ],
    body: [
      ...bill.lines.map((l) => row(`${l.qty} x ${l.itemName}`, money(l.lineSubtotalMinor), cols)),
      rule(cols),
      row("Subtotal", money(bill.subtotalMinor), cols),
      ...bill.taxBreakdown.map((t) => row(`${t.name} ${t.rate}%`, money(BigInt(t.amountMinor)), cols)),
      text(""),
      { kind: "text", text: `${"TOTAL".padEnd(Math.max(1, cols - money(bill.grandTotalMinor).length - 1))} ${money(bill.grandTotalMinor)}`, bold: true },
    ],
    footer: [rule(cols), text("Thank you — pay at the counter", { align: "center" })],
  };
};
