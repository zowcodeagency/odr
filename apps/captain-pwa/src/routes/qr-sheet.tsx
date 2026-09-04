import { useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button, IconButton } from "@odr/ui";
import { api } from "../lib/api.ts";
import { navigate } from "../lib/router.ts";
import { useAsync } from "../lib/use-async.ts";
import { QrImage, tableQrUrl } from "../features/qr/qr-image.tsx";
import { Logo } from "../shell/logo.tsx";
import type { Session } from "../lib/session.ts";

/** A4 sheet of table QR cards — cut along the grid, stand one on each table. */
export const QrSheetRoute = ({ session }: { session: Session }) => {
  // Off = bare QR + table number, for owners who print on their own stationery.
  const [branding, setBranding] = useState(true);
  const q = useAsync(async () => {
    const [tables, { publicToken }] = await Promise.all([
      api.tables(session.outletId),
      api.qrToken(session.outletId),
    ]);
    return { tables, publicToken };
  }, [session.outletId]);

  if (q.loading && !q.data)
    return <p className="p-8 text-[14px] text-[var(--fg-tertiary)]">Building the sheet…</p>;
  if (!q.data)
    return (
      <div className="p-8">
        <p className="text-[14px] text-[var(--status-voided)]">{q.error}</p>
        <Button className="mt-4" onClick={() => navigate({ name: "settings" })}>
          Back to settings
        </Button>
      </div>
    );

  const { tables, publicToken } = q.data;

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-7 lg:px-10 max-w-[900px] mx-auto">
      <header className="flex items-center gap-3 mb-6" data-print="hide">
        <IconButton label="Back" size="sm" onClick={() => navigate({ name: "settings" })}>
          <ArrowLeft size={16} />
        </IconButton>
        <div className="flex-1">
          <h1 className="text-[19px] font-semibold tracking-[-0.02em]">QR sheet</h1>
          <p className="text-[13px] text-[var(--fg-tertiary)]">
            {tables.length} card{tables.length === 1 ? "" : "s"} · A4 · cut along the grid
          </p>
        </div>
        <Button size="lg" onClick={() => window.print()}>
          <Printer size={16} /> Print
        </Button>
      </header>

      <p data-print="hide" className="mb-4 text-[14px] select-none">
        <label className="inline-flex items-center gap-2 min-h-11 cursor-pointer">
          <input
            type="checkbox"
            checked={branding}
            onChange={(e) => setBranding(e.target.checked)}
            className="h-4.5 w-4.5 accent-[var(--accent)]"
          />
          Show branding
        </label>
        <span className="ml-1.5 text-[12px] text-[var(--fg-muted)]">
          — off prints bare codes for your own card design
        </span>
      </p>

      {tables.length === 0 ? (
        <p className="text-[13px] text-[var(--fg-muted)]">
          Add tables in Settings first — the sheet prints one card per table.
        </p>
      ) : (
        <div
          data-print-area="sheet"
          className="grid grid-cols-2 sm:grid-cols-3 print:grid-cols-3 gap-3 bg-white p-3 rounded-[var(--radius-3)]"
        >
          {tables.map((t) => (
            <article
              key={t.id}
              className="border border-dashed border-black/40 rounded-md p-3 text-center text-black break-inside-avoid"
            >
              <p className="text-[18px] font-semibold leading-none">{t.label}</p>
              <QrImage
                value={tableQrUrl(session.outletId, t.label, publicToken)}
                size={132}
                className="mx-auto my-2.5"
              />
              {branding ? (
                <>
                  <p className="text-[12px] font-medium">Scan to order</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] opacity-70">
                    {session.outletName}
                  </p>
                  <span className="mt-2 inline-block">
                    <Logo size={18} wordmark />
                  </span>
                </>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
