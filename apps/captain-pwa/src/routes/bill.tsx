import { ArrowLeft, Printer, Wifi } from "lucide-react";
import { Button, IconButton, Receipt, formatMinor } from "@odr/ui";
import { api, errorCode } from "../lib/api.ts";
import { navigate } from "../lib/router.ts";
import { useAsync } from "../lib/use-async.ts";
import { toast } from "../lib/toast.tsx";
import { ThermalTicket } from "../features/print/thermal-ticket.tsx";
import type { Session } from "../lib/session.ts";

/** Tax strategies return fractions (0.025); the receipt speaks basis points. */
const toBps = (rate: number) => Math.round(rate * 10000);

export const BillRoute = ({
  billId,
  session,
}: {
  billId: string;
  session: Session;
}) => {
  const q = useAsync(async () => {
    const bill = await api.bill(billId);
    // The bill carries no table label — the order it settled does.
    const order = await api.order(bill.orderId).catch(() => null);
    return { bill, order };
  }, [billId]);

  if (q.loading && !q.data)
    return <p className="p-8 text-[14px] text-[var(--fg-tertiary)]">Loading the bill…</p>;
  if (!q.data)
    return (
      <div className="p-8">
        <p className="text-[14px] text-[var(--status-voided)]">{q.error ?? "Bill not found"}</p>
        <Button className="mt-4" onClick={() => navigate({ name: "tables" })}>
          Back to tables
        </Button>
      </div>
    );

  const { bill, order } = q.data;
  const tableLabel = order?.tableLabel ?? "—";
  const currency = bill.currency;
  const money = (m: string) => formatMinor(m, currency, { withSymbol: false });

  const networkPrint = async () => {
    try {
      await api.printBill(bill.id);
      toast("Sent to the counter printer");
    } catch (e) {
      toast(
        errorCode(e) === "NO_PRINTER"
          ? "No network printer configured — use Print instead"
          : e instanceof Error
            ? e.message
            : "Print failed",
      );
    }
  };

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-7 lg:px-10 max-w-[1100px] mx-auto" data-print="hide">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <IconButton label="Back" size="sm" onClick={() => navigate({ name: "tables" })}>
            <ArrowLeft size={16} />
          </IconButton>
          <div>
            <h1 className="text-[19px] sm:text-[20px] font-semibold tracking-[-0.02em] font-mono">
              {bill.invoiceNumber}
            </h1>
            <p className="mt-0.5 text-[13px] text-[var(--fg-tertiary)]">
              Settled · {tableLabel} · {new Date(bill.settledAt).toLocaleString("en-GB")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="lg" onClick={() => void networkPrint()}>
            <Wifi size={15} /> Kitchen printer
          </Button>
          <Button size="lg" onClick={() => window.print()}>
            <Printer size={15} /> Print
          </Button>
        </div>
      </header>

      <Receipt
        outletName={session.outletName}
        outletAddress={session.outletAddress ?? ""}
        {...(session.outletGstin ? { gstin: session.outletGstin } : {})}
        invoiceNumber={bill.invoiceNumber}
        issuedAt={new Date(bill.settledAt)}
        tableLabel={tableLabel}
        captain={session.email.split("@")[0] ?? ""}
        currency={currency}
        lines={bill.lines.map((l) => ({
          name: l.itemName,
          qty: l.qty,
          unitPriceMinor: l.unitPriceMinor,
          lineSubtotalMinor: l.lineSubtotalMinor,
        }))}
        taxBreakdown={bill.taxBreakdown.map((t) => ({
          componentName: t.name,
          rateBps: toBps(t.rate),
          amountMinor: t.amountMinor,
        }))}
        subtotalMinor={bill.subtotalMinor}
        taxTotalMinor={bill.taxTotalMinor}
        grandTotalMinor={bill.grandTotalMinor}
      />

      {/* Paper */}
      <ThermalTicket
        paperWidth={session.paperWidth}
        title={session.outletName}
        subtitle={
          <>
            {session.outletAddress}
            {session.outletGstin ? <div>GSTIN {session.outletGstin}</div> : null}
          </>
        }
        meta={[
          ["Invoice", bill.invoiceNumber],
          ["Table", tableLabel],
          ["Date", new Date(bill.settledAt).toLocaleString("en-GB")],
        ]}
        lines={bill.lines.map((l) => ({
          name: l.itemName,
          qty: l.qty,
          amount: money(l.lineSubtotalMinor),
        }))}
        totals={[
          ["Subtotal", money(bill.subtotalMinor)],
          ...bill.taxBreakdown.map(
            (t) =>
              [`${t.name} @ ${(t.rate * 100).toFixed(2)}%`, money(t.amountMinor)] as [
                string,
                string,
              ],
          ),
        ]}
        grand={["TOTAL", formatMinor(bill.grandTotalMinor, currency)]}
        footer="Thank you · come again"
      />
    </div>
  );
};
