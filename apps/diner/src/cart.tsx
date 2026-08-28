/* Cart sheet: qty steppers, per-line notes, optional name, place order. */

import { useState } from "react";
import { rupees } from "./api.ts";
import type { Line } from "./app.tsx";
import { CloseIcon, Stepper, VegBadge } from "./ui.tsx";

export function CartSheet({
  lines,
  onQty,
  onNote,
  onClose,
  onPlace,
}: {
  lines: Line[];
  onQty: (line: Line, qty: number) => void;
  onNote: (itemId: string, note: string) => void;
  onClose: () => void;
  onPlace: (customerName: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const total = lines.reduce((n, l) => n + l.qty * l.priceMinor, 0);
  const count = lines.reduce((n, l) => n + l.qty, 0);

  const place = async () => {
    if (busy || lines.length === 0) return;
    setBusy(true);
    setFailed(false);
    try {
      await onPlace(name.trim());
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <div
      className="animate-sheet fixed inset-0 z-40 mx-auto flex max-w-[520px] flex-col bg-bg"
      role="dialog"
      aria-label="Your order"
    >
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-[18px] font-bold tracking-tight">Your order</h2>
          <p className="text-[13px] text-muted">
            <span className="tabular-nums">{count}</span> {count === 1 ? "item" : "items"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to menu"
          className="flex size-11 items-center justify-center rounded-xl text-muted transition-colors active:bg-surface"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4">
        {lines.length === 0 ? (
          <p className="py-16 text-center text-[15px] text-muted">
            Your cart is empty — add something from the menu.
          </p>
        ) : (
          <ul>
            {lines.map((l) => (
              <li key={l.itemId} className="border-b py-4 last:border-b-0">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <VegBadge isVeg={l.isVeg} />
                      <h3 className="truncate text-[16px] font-semibold">{l.name}</h3>
                    </div>
                    <p className="mt-1 text-[14px] text-muted tabular-nums">
                      {rupees(l.priceMinor)} each
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Stepper qty={l.qty} label={l.name} onChange={(n) => onQty(l, n)} />
                    <span className="text-[15px] font-bold tabular-nums">
                      {rupees(l.qty * l.priceMinor)}
                    </span>
                  </div>
                </div>
                <input
                  value={l.note}
                  onChange={(e) => onNote(l.itemId, e.target.value.slice(0, 120))}
                  placeholder="Add a note — e.g. less spicy"
                  aria-label={`Note for ${l.name}`}
                  className="mt-3 h-11 w-full rounded-xl bg-surface px-3.5 text-[14px] transition-colors focus:bg-raised focus:outline-2 focus:outline-accent"
                />
              </li>
            ))}
          </ul>
        )}

        {lines.length > 0 ? (
          <label className="mt-6 block">
            <span className="text-[13px] font-semibold text-muted">Name for the order</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              placeholder="Optional"
              autoComplete="name"
              className="mt-1.5 h-12 w-full rounded-xl border bg-raised px-3.5 text-[16px] transition-colors focus:border-accent"
            />
          </label>
        ) : null}

        <div className="h-6" />
      </div>

      <footer
        className="border-t bg-bg px-4 pt-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        {failed ? (
          <p className="mb-2 text-center text-[14px] font-medium text-nonveg">
            Couldn&rsquo;t send your order. Please try again.
          </p>
        ) : null}
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-[15px] text-muted">Total</span>
          <span className="text-[20px] font-bold tabular-nums">{rupees(total)}</span>
        </div>
        <button
          type="button"
          onClick={place}
          disabled={busy || lines.length === 0}
          className="h-14 w-full rounded-2xl bg-accent text-[17px] font-bold text-accent-ink transition-all duration-200 active:scale-[0.99] disabled:opacity-45"
        >
          {busy ? "Sending…" : "Place order — pay at counter"}
        </button>
        <p className="mt-2 text-center text-[13px] text-muted">
          No payment here. Pay at the counter — cash or UPI.
        </p>
      </footer>
    </div>
  );
}
