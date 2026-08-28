import { useCallback, useEffect, useMemo, useState } from "react";

export interface CartItemModifier {
  id: string;
  name: string;
  priceDeltaMinor: bigint;
}

export interface CartItem {
  itemId: string;
  itemName: string;
  qty: number;
  unitPriceMinor: bigint;
  taxClass: string;
  isVeg: boolean;
  /** Kitchen instruction for this line — "no onion", "less spicy". */
  note?: string;
  modifiers: CartItemModifier[];
}

export type NewCartItem = Omit<CartItem, "qty"> & { qty?: number };

/**
 * Add or merge. A note makes the line distinct — two "Dosa (no onion)" merge,
 * but a plain dosa never folds into a noted one.
 */
export const addLine = (prev: CartItem[], it: NewCartItem): CartItem[] => {
  const at = prev.findIndex(
    (p) =>
      p.itemId === it.itemId &&
      (p.note ?? "") === (it.note ?? "") &&
      JSON.stringify(p.modifiers) === JSON.stringify(it.modifiers),
  );
  if (at >= 0) return prev.map((p, i) => (i === at ? { ...p, qty: p.qty + (it.qty ?? 1) } : p));
  return [...prev, { ...it, qty: it.qty ?? 1 }];
};

export const subtotalOf = (items: CartItem[]): bigint =>
  items.reduce<bigint>((acc, it) => {
    const mods = it.modifiers.reduce<bigint>((a, m) => a + m.priceDeltaMinor, 0n);
    return acc + (it.unitPriceMinor + mods) * BigInt(it.qty);
  }, 0n);

/*
 * Unsent lines survive a reload. A waiter takes eight items at the table, the
 * phone locks, the PWA reboots — retyping the order is the difference between
 * this thing being trusted and not. Money is bigint, so it needs a codec.
 */
export const encodeCart = (items: CartItem[]): string =>
  JSON.stringify(items, (_k, v) => (typeof v === "bigint" ? v.toString() : v));

export const decodeCart = (raw: string | null): CartItem[] => {
  try {
    if (!raw) return [];
    return (JSON.parse(raw) as CartItem[]).map((it) => ({
      ...it,
      unitPriceMinor: BigInt(it.unitPriceMinor),
      modifiers: it.modifiers.map((m) => ({ ...m, priceDeltaMinor: BigInt(m.priceDeltaMinor) })),
    }));
  } catch {
    return [];
  }
};

const read = (key: string): CartItem[] => {
  try {
    return decodeCart(localStorage.getItem(key));
  } catch {
    return [];
  }
};

export const useCart = (storageKey?: string) => {
  const [items, setItems] = useState<CartItem[]>(() => (storageKey ? read(storageKey) : []));

  useEffect(() => {
    if (!storageKey) return;
    try {
      if (items.length === 0) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, encodeCart(items));
    } catch {
      // A full or blocked store must never break taking the order.
    }
  }, [storageKey, items]);

  const add = useCallback((it: NewCartItem) => setItems((prev) => addLine(prev, it)), []);

  const setQty = useCallback((index: number, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((_, i) => i !== index)
        : prev.map((p, i) => (i === index ? { ...p, qty } : p)),
    );
  }, []);

  const setNote = useCallback((index: number, note: string) => {
    setItems((prev) => prev.map((p, i) => (i === index ? { ...p, note } : p)));
  }, []);

  const remove = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const subtotalMinor = useMemo(() => subtotalOf(items), [items]);

  const totalQty = items.reduce((acc, it) => acc + it.qty, 0);

  return { items, add, setQty, setNote, remove, clear, subtotalMinor, totalQty };
};
