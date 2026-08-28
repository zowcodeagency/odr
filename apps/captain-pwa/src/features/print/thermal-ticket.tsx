import type { ReactNode } from "react";

/**
 * The only thing that reaches paper.
 *
 * Hidden on screen, revealed by the `@media print` block in index.css, which
 * blanks the rest of the app. Width follows the outlet's roll:
 * 58mm roll ≈ 48mm printable, 80mm roll ≈ 72mm printable.
 */
export const printableWidth = (paperWidth: number): string =>
  paperWidth === 58 ? "48mm" : "72mm";

export interface TicketLine {
  name: string;
  qty: number;
  /** Omitted on a KOT — the kitchen doesn't price anything. */
  amount?: string;
  note?: string | null;
}

export const ThermalTicket = ({
  paperWidth,
  title,
  subtitle,
  meta = [],
  lines,
  totals = [],
  grand,
  footer,
}: {
  paperWidth: number;
  title: string;
  subtitle?: ReactNode;
  meta?: [string, string][];
  lines: TicketLine[];
  totals?: [string, string][];
  grand?: [string, string];
  footer?: string;
}) => (
  <div
    data-print-area
    style={{ ["--print-width" as string]: printableWidth(paperWidth) }}
    className="hidden print:block font-mono text-[11px] leading-[1.45] text-black"
  >
    <div className="text-center">
      <div className="text-[13px] font-semibold uppercase">{title}</div>
      {subtitle ? <div className="text-[10px]">{subtitle}</div> : null}
    </div>

    <div className="my-1 border-t border-dashed border-black" />

    {meta.map(([k, v]) => (
      <div key={k} className="flex justify-between gap-2">
        <span>{k}</span>
        <span>{v}</span>
      </div>
    ))}

    <div className="my-1 border-t border-dashed border-black" />

    <table className="w-full">
      <tbody>
        {lines.map((l, i) => (
          <tr key={i} className="align-top">
            <td className="pr-1 w-6 tabular-nums">{l.qty}×</td>
            <td className="pr-1">
              {l.name}
              {l.note ? <div className="pl-1">* {l.note}</div> : null}
            </td>
            {l.amount !== undefined ? (
              <td className="text-right tabular-nums whitespace-nowrap">{l.amount}</td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>

    {totals.length > 0 || grand ? (
      <>
        <div className="my-1 border-t border-dashed border-black" />
        {totals.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <span>{k}</span>
            <span className="tabular-nums">{v}</span>
          </div>
        ))}
        {grand ? (
          <div className="mt-1 pt-1 border-t border-black flex justify-between gap-2 text-[13px] font-semibold">
            <span>{grand[0]}</span>
            <span className="tabular-nums">{grand[1]}</span>
          </div>
        ) : null}
      </>
    ) : null}

    {footer ? (
      <>
        <div className="my-1 border-t border-dashed border-black" />
        <div className="text-center text-[10px] uppercase">{footer}</div>
      </>
    ) : null}
  </div>
);
