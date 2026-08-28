/*
 * Diner app shell: QR context, cart state, and which screen is on.
 *
 * There are only three screens (menu, cart sheet over it, order placed), so
 * the "router" is this component's state — the hash is read once, on boot.
 */

import { useEffect, useState } from "react";
import { api, loadCtx, type Ctx, type Menu, type MenuItem, type PlacedOrder } from "./api.ts";
import { CartSheet } from "./cart.tsx";
import { MenuScreen } from "./menu.tsx";
import { PlacedScreen } from "./placed.tsx";
import { CloseIcon } from "./ui.tsx";

export type Line = {
  itemId: string;
  name: string;
  isVeg?: boolean | null;
  priceMinor: number;
  qty: number;
  note: string;
};

const CART_KEY = "odr.diner.cart";
const ORDER_KEY = "odr.diner.order";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function App() {
  const [ctx] = useState<Ctx | null>(loadCtx);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [broken, setBroken] = useState(!ctx);
  const [lines, setLines] = useState<Line[]>(() => read<Line[]>(CART_KEY, []));
  const [placed, setPlaced] = useState<PlacedOrder | null>(() =>
    read<PlacedOrder | null>(ORDER_KEY, null),
  );
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    if (!ctx) return;
    let live = true;
    api
      .menu(ctx)
      .then((m) => live && setMenu(m))
      .catch(() => live && setBroken(true));
    return () => {
      live = false;
    };
  }, [ctx]);

  // Survive a refresh mid-order.
  useEffect(() => {
    sessionStorage.setItem(CART_KEY, JSON.stringify(lines));
  }, [lines]);
  useEffect(() => {
    if (placed) sessionStorage.setItem(ORDER_KEY, JSON.stringify(placed));
    else sessionStorage.removeItem(ORDER_KEY);
  }, [placed]);

  /** One qty path for both screens. 0 removes the line; 20 is the ceiling. */
  const setQty = (item: MenuItem, qty: number, priceMinor: number) => {
    const next = Math.min(20, Math.max(0, qty));
    setLines((prev) => {
      if (next === 0) return prev.filter((l) => l.itemId !== item.id);
      if (!prev.some((l) => l.itemId === item.id))
        return [
          ...prev,
          { itemId: item.id, name: item.name, isVeg: item.isVeg, priceMinor, qty: next, note: "" },
        ];
      return prev.map((l) => (l.itemId === item.id ? { ...l, qty: next } : l));
    });
  };

  const setNote = (itemId: string, note: string) =>
    setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, note } : l)));

  if (broken || !ctx) return <Unavailable />;

  if (placed)
    return (
      <PlacedScreen
        ctx={ctx}
        order={placed}
        onOrderMore={() => {
          setPlaced(null);
          setLines([]);
        }}
      />
    );

  if (!menu) return <Loading />;

  return (
    <>
      <MenuScreen
        menu={menu}
        tableLabel={ctx.label}
        lines={lines}
        onQty={setQty}
        onOpenCart={() => setCartOpen(true)}
      />
      {cartOpen ? (
        <CartSheet
          lines={lines}
          onQty={(line, qty) =>
            setQty({ id: line.itemId, name: line.name, isVeg: line.isVeg }, qty, line.priceMinor)
          }
          onNote={setNote}
          onClose={() => setCartOpen(false)}
          onPlace={async (customerName) => {
            const res = await api.place(ctx, {
              ...(customerName ? { customerName } : {}),
              lines: lines.map((l) => ({
                itemId: l.itemId,
                qty: l.qty,
                ...(l.note.trim() ? { note: l.note.trim() } : {}),
              })),
            });
            setCartOpen(false);
            setLines([]);
            setPlaced(res);
          }}
        />
      ) : null}
    </>
  );
}

function Loading() {
  return (
    <div className="mx-auto max-w-[520px] px-4 pt-6">
      <div className="h-7 w-40 animate-pulse rounded-md bg-surface" />
      <div className="mt-2 h-4 w-24 animate-pulse rounded-md bg-surface" />
      <div className="mt-7 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
      <span className="sr-only">Loading the menu</span>
    </div>
  );
}

/** Anything that goes wrong — bad token, dead API, junk URL — lands here. */
function Unavailable() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent">
        <CloseIcon className="size-6" />
      </span>
      <h1 className="mt-6 text-[22px] font-bold tracking-tight">This menu isn&rsquo;t available</h1>
      <p className="mt-2 max-w-[26ch] text-[15px] leading-relaxed text-muted">
        Please ask the staff — they&rsquo;ll take your order at the table.
      </p>
      <button
        type="button"
        onClick={() => location.reload()}
        className="mt-7 min-h-11 rounded-xl border px-5 font-semibold text-ink transition-colors active:bg-surface"
      >
        Try again
      </button>
    </main>
  );
}
