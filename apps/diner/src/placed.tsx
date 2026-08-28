/* Order placed: the code to show at the counter + live status (polled 8s). */

import { useEffect, useState } from "react";
import {
  api,
  rupees,
  stepOf,
  STEPS,
  toMinor,
  type Ctx,
  type OrderStatus,
  type PlacedOrder,
} from "./api.ts";
import { CheckIcon } from "./ui.tsx";

export function PlacedScreen({
  ctx,
  order,
  onOrderMore,
}: {
  ctx: Ctx;
  order: PlacedOrder;
  onOrderMore: () => void;
}) {
  const [status, setStatus] = useState<OrderStatus | null>(null);

  // Poll every 8s. A failed poll keeps the last known state — the diner is
  // holding a valid code either way, no scary screen for a dropped packet.
  useEffect(() => {
    let live = true;
    const tick = () =>
      api
        .order(ctx, order.orderId)
        .then((s) => live && setStatus(s))
        .catch(() => {});
    tick();
    const id = setInterval(tick, 8000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [ctx, order.orderId]);

  const step = stepOf(status?.status ?? "open");
  const voided = status?.status === "voided";

  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col px-5 pt-10 pb-8">
      <div className="animate-fade text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <CheckIcon className="size-6" />
        </span>
        <h1 className="mt-5 text-[22px] font-bold tracking-tight">Order placed</h1>
        <p className="mt-1 text-[15px] text-muted">
          Table <span className="font-semibold text-ink">{status?.tableLabel ?? ctx.label}</span>
        </p>

        <div className="mt-6 rounded-2xl bg-gold-soft px-6 py-5">
          <p className="text-[12px] font-bold tracking-[0.14em] text-gold uppercase">Order code</p>
          <p className="mt-1 text-[40px] leading-none font-bold tracking-[0.12em] text-ink tabular-nums">
            {order.code}
          </p>
        </div>

        <p className="mx-auto mt-4 max-w-[30ch] text-[15px] leading-relaxed text-muted">
          Show this at the counter — pay by cash or UPI there.
        </p>
      </div>

      <section className="mt-9" aria-label="Order status">
        {voided ? (
          <p className="rounded-xl bg-surface px-4 py-3 text-center text-[15px] text-muted">
            This order was cancelled. Please ask the staff.
          </p>
        ) : (
          <div className="relative">
            <div className="absolute top-[13px] right-[16.7%] left-[16.7%] h-[2px] bg-line" />
            <div
              className="absolute top-[13px] left-[16.7%] h-[2px] bg-accent transition-all duration-300"
              style={{ width: `${step * 33.3}%` }}
            />
            <ol className="relative flex">
              {STEPS.map((label, i) => (
                <li key={label} className="flex flex-1 flex-col items-center gap-2">
                  <span
                    className={`flex size-7 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                      i < step
                        ? "border-accent bg-accent text-accent-ink"
                        : i === step
                          ? "border-accent bg-bg text-accent"
                          : "border-line bg-bg text-muted"
                    }`}
                  >
                    {i < step ? (
                      <CheckIcon className="size-3.5" />
                    ) : (
                      <span
                        className={`size-2 rounded-full ${i === step ? "animate-pulse bg-accent" : "bg-line"}`}
                      />
                    )}
                  </span>
                  <span
                    className={`text-center text-[13px] ${i <= step ? "font-semibold text-ink" : "text-muted"}`}
                  >
                    {label}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      {status ? (
        <section className="mt-9 rounded-2xl border bg-surface px-4 py-3" aria-label="Order summary">
          <ul className="divide-y">
            {status.lines.map((l, i) => (
              <li key={`${l.itemName}-${i}`} className="flex justify-between gap-3 py-2 text-[15px]">
                <span className="min-w-0 truncate">{l.itemName}</span>
                <span className="shrink-0 text-muted tabular-nums">× {l.qty}</span>
              </li>
            ))}
          </ul>
          <div className="mt-1 flex justify-between border-t pt-3 text-[16px] font-bold">
            <span>Total</span>
            <span className="tabular-nums">{rupees(toMinor(status.totalMinor) ?? 0)}</span>
          </div>
        </section>
      ) : null}

      <div className="flex-1" />

      <button
        type="button"
        onClick={onOrderMore}
        className="mt-8 h-14 w-full rounded-2xl border text-[16px] font-bold transition-colors duration-200 active:bg-surface"
      >
        Order more
      </button>
    </main>
  );
}
