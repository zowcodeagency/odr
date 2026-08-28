/* Menu screen: outlet header, sticky category chips, item cards, cart bar. */

import { useEffect, useMemo, useState } from "react";
import { minorOf, rupees, type Menu, type MenuItem } from "./api.ts";
import type { Line } from "./app.tsx";
import { ChevronIcon, Stepper, VegBadge } from "./ui.tsx";

/** Height of the sticky header + chip rail — the scroll-spy offset. */
const STUCK = 112;

export function MenuScreen({
  menu,
  tableLabel,
  lines,
  onQty,
  onOpenCart,
}: {
  menu: Menu;
  tableLabel: string;
  lines: Line[];
  onQty: (item: MenuItem, qty: number, priceMinor: number) => void;
  onOpenCart: () => void;
}) {
  const cats = useMemo(
    () => menu.categories.filter((c) => c.items.length > 0),
    [menu],
  );
  const qtyOf = useMemo(
    () => new Map(lines.map((l) => [l.itemId, l.qty])),
    [lines],
  );
  const [active, setActive] = useState(cats[0]?.id ?? "");

  // Scroll-spy: the last section whose top has passed under the header.
  useEffect(() => {
    const onScroll = () => {
      let cur = cats[0]?.id ?? "";
      for (const c of cats) {
        const el = document.getElementById(`cat-${c.id}`);
        if (el && el.getBoundingClientRect().top - STUCK <= 4) cur = c.id;
      }
      setActive(cur);
    };
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, [cats]);

  // Keep the active chip in view on the rail.
  useEffect(() => {
    document
      .getElementById(`chip-${active}`)
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active]);

  const jump = (id: string) => {
    const el = document.getElementById(`cat-${id}`);
    if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY - STUCK + 1, behavior: "smooth" });
  };

  const count = lines.reduce((n, l) => n + l.qty, 0);
  const total = lines.reduce((n, l) => n + l.qty * l.priceMinor, 0);

  return (
    <div className="mx-auto max-w-[520px] pb-32">
      <header className="sticky top-0 z-20 border-b bg-bg/92 backdrop-blur-md">
        <div className="px-4 pt-4 pb-3">
          <h1 className="truncate text-[21px] leading-tight font-bold tracking-tight">
            {menu.outlet.name}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Table <span className="font-semibold text-ink">{tableLabel}</span> · Order from your phone
          </p>
        </div>
        <nav className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3" aria-label="Menu categories">
          {cats.map((c) => (
            <button
              key={c.id}
              id={`chip-${c.id}`}
              type="button"
              onClick={() => jump(c.id)}
              aria-current={active === c.id}
              className={`min-h-9 shrink-0 rounded-full border px-3.5 text-[14px] font-semibold whitespace-nowrap transition-colors duration-200 ${
                active === c.id
                  ? "border-accent bg-accent text-accent-ink"
                  : "bg-raised text-muted"
              }`}
            >
              {c.name}
            </button>
          ))}
        </nav>
      </header>

      <main className="px-4">
        {cats.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-28">
            <h2 className="pt-7 pb-1 text-[12px] font-bold tracking-[0.12em] text-muted uppercase">
              {c.name}
            </h2>
            <ul>
              {c.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  qty={qtyOf.get(item.id) ?? 0}
                  onQty={onQty}
                />
              ))}
            </ul>
          </section>
        ))}
        <p className="py-10 text-center text-[13px] text-muted">
          Pay at the counter — cash or UPI.
        </p>
      </main>

      {count > 0 ? (
        <div
          className="animate-fade fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[520px] p-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={onOpenCart}
            className="shadow-bar flex h-14 w-full items-center justify-between rounded-2xl bg-accent px-5 text-accent-ink transition-transform duration-200 active:scale-[0.99]"
          >
            <span className="text-[15px] font-medium">
              <span className="tabular-nums">{count}</span> {count === 1 ? "item" : "items"} ·{" "}
              <span className="font-bold tabular-nums">{rupees(total)}</span>
            </span>
            <span className="flex items-center gap-1 text-[16px] font-bold">
              View cart <ChevronIcon className="size-4" />
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ItemRow({
  item,
  qty,
  onQty,
}: {
  item: MenuItem;
  qty: number;
  onQty: (item: MenuItem, qty: number, priceMinor: number) => void;
}) {
  const minor = minorOf(item);
  return (
    <li className="flex items-start gap-4 border-b py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <VegBadge isVeg={item.isVeg} />
          <h3 className="truncate text-[17px] leading-snug font-semibold">{item.name}</h3>
        </div>
        {item.description ? (
          <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-muted">
            {item.description}
          </p>
        ) : null}
        <p className="mt-2 text-[16px] font-semibold tabular-nums">{rupees(minor)}</p>
      </div>

      <div className="w-[112px] shrink-0 pt-0.5">
        {qty > 0 ? (
          <Stepper qty={qty} label={item.name} onChange={(n) => onQty(item, n, minor)} />
        ) : (
          <button
            type="button"
            onClick={() => onQty(item, 1, minor)}
            className="h-11 w-full rounded-xl border border-accent/40 bg-raised text-[15px] font-bold text-accent transition-colors duration-150 active:bg-accent-soft"
          >
            Add
          </button>
        )}
      </div>
    </li>
  );
}
