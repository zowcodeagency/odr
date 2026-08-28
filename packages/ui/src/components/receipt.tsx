import { cn } from "../lib/cn.ts";
import { formatMinor, type Currency } from "../lib/money.ts";

export interface ReceiptLine {
  name: string;
  qty: number;
  unitPriceMinor: bigint | string;
  lineSubtotalMinor: bigint | string;
  modifiers?: { name: string; priceDeltaMinor: bigint | string }[];
}

export interface TaxBreakdownRow {
  componentName: string;     // CGST | SGST | IGST | VAT
  rateBps: number;           // basis points: 250 = 2.5%
  amountMinor: bigint | string;
}

export interface ReceiptProps {
  outletName: string;
  outletAddress: string;
  gstin?: string;            // India
  vatNumber?: string;        // KSA
  invoiceNumber: string;     // MC/2026-27/00001
  issuedAt: Date;
  tableLabel: string;
  captain: string;
  currency?: Currency;
  lines: ReceiptLine[];
  taxBreakdown: TaxBreakdownRow[];
  subtotalMinor: bigint | string;
  taxTotalMinor: bigint | string;
  grandTotalMinor: bigint | string;
  /** ZATCA QR (KSA) or e-invoice QR (IN B2B). Optional — render only if present. */
  qrDataUrl?: string;
  className?: string;
}

const fmtBps = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
const fmtTime = (d: Date) =>
  d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * GST/VAT-compliant printable receipt.
 * Per brief §14 #6 — multi-rate tax is rendered as separate rows.
 */
export const Receipt = ({
  outletName,
  outletAddress,
  gstin,
  vatNumber,
  invoiceNumber,
  issuedAt,
  tableLabel,
  captain,
  currency = "INR",
  lines,
  taxBreakdown,
  subtotalMinor,
  taxTotalMinor,
  grandTotalMinor,
  qrDataUrl,
  className,
}: ReceiptProps) => (
  <article
    className={cn(
      "surface-receipt",
      "max-w-[420px] mx-auto",
      "px-7 py-8",
      "rounded-[var(--radius-3)]",
      "shadow-[var(--shadow-receipt)]",
      className,
    )}
  >
    {/* Branding */}
    <header className="text-center">
      <h2 className="text-[18px] font-semibold tracking-[0.02em] uppercase text-[var(--bg-receipt-ink)]">
        {outletName}
      </h2>
      <p className="mt-2 text-[12px] leading-snug">{outletAddress}</p>
      {gstin ? (
        <p className="mt-1 text-[11px] uppercase tracking-[0.10em]">GSTIN · {gstin}</p>
      ) : null}
      {vatNumber ? (
        <p className="mt-1 text-[11px] uppercase tracking-[0.10em]">VAT · {vatNumber}</p>
      ) : null}
    </header>

    <hr className="divider-dotted" />

    <div className="flex justify-between text-[12px]">
      <span>Invoice</span>
      <span className="font-medium">{invoiceNumber}</span>
    </div>
    <div className="flex justify-between text-[12px]">
      <span>{fmtTime(issuedAt)}</span>
      <span>
        {tableLabel} · {captain}
      </span>
    </div>

    <hr className="divider-dotted" />

    {/* Lines */}
    <table className="w-full text-[12px]">
      <thead className="text-[10px] uppercase tracking-[0.10em] text-current/60">
        <tr>
          <th className="text-left font-normal py-1">Item</th>
          <th className="text-right font-normal py-1 w-8">Qty</th>
          <th className="text-right font-normal py-1 w-20">Total</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={i} className="align-top">
            <td className="py-1 pr-2">
              <div>{l.name}</div>
              {l.modifiers?.map((m, j) => (
                <div key={j} className="pl-3 text-[11px] opacity-70">
                  + {m.name}
                </div>
              ))}
            </td>
            <td className="text-right tabular-nums py-1">{l.qty}</td>
            <td className="text-right tabular-nums py-1">
              {formatMinor(l.lineSubtotalMinor, currency, { withSymbol: false })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <hr className="divider-dotted" />

    {/* Subtotal */}
    <div className="flex justify-between text-[12px]">
      <span>Subtotal</span>
      <span className="tabular-nums">
        {formatMinor(subtotalMinor, currency, { withSymbol: false })}
      </span>
    </div>

    {/* Tax — per (component, rate). Never collapsed. */}
    {taxBreakdown.map((t, i) => (
      <div key={i} className="flex justify-between text-[12px]">
        <span>
          {t.componentName} @ {fmtBps(t.rateBps)}
        </span>
        <span className="tabular-nums">
          {formatMinor(t.amountMinor, currency, { withSymbol: false })}
        </span>
      </div>
    ))}

    <div className="flex justify-between text-[12px]">
      <span>Tax total</span>
      <span className="tabular-nums">
        {formatMinor(taxTotalMinor, currency, { withSymbol: false })}
      </span>
    </div>

    <hr className="divider-dotted" />

    <div className="flex justify-between items-baseline">
      <span className="text-[14px] uppercase tracking-[0.12em]">Total</span>
      <span className="text-[22px] font-semibold tabular-nums">
        {formatMinor(grandTotalMinor, currency)}
      </span>
    </div>

    {qrDataUrl ? (
      <>
        <hr className="divider-dotted" />
        <div className="flex justify-center pt-2">
          <img src={qrDataUrl} alt="invoice QR" width={120} height={120} />
        </div>
      </>
    ) : null}

    <hr className="divider-dotted" />

    <p className="text-center text-[11px] uppercase tracking-[0.14em] mt-2">
      Thank you · come again
    </p>
  </article>
);
