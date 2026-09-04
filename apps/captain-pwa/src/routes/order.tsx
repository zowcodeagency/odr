import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Flame,
  HardDrive,
  Loader2,
  Plus,
  Printer,
  ReceiptText,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  CartLine,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  IconButton,
  MenuItemCard,
  Money,
  Separator,
  Sheet,
  SheetContent,
  SheetTitle,
  StatusPill,
  type OrderStatus,
} from "@odr/ui";
import { api, decimalToMinor, errorCode, orderTotalMinor, type Order } from "../lib/api.ts";
import { navigate } from "../lib/router.ts";
import { useAsync } from "../lib/use-async.ts";
import { toast } from "../lib/toast.tsx";
import { useCart } from "../features/ordering/use-cart.ts";
import { CHANNEL_LABEL, CHANNEL_TONE } from "../features/ordering/channels.ts";
import { ThermalTicket } from "../features/print/thermal-ticket.tsx";
import { canManage, type Session } from "../lib/session.ts";
import { HoldButton } from "../features/billing/hold-button.tsx";
import { buildLocalBill, fiscalYearFor } from "../features/billing/local-bill.ts";
import { localBills } from "../lib/local-db.ts";

/** How long "Settle & bill" is held before the bill stays on this device. */
const HOLD_MS = 5000;

export const OrderRoute = ({
  orderId,
  session,
}: {
  orderId: string;
  session: Session;
}) => {
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [askCustomer, setAskCustomer] = useState(false);
  // Set by holding "Settle & bill": the invoice is written to this device, not the cloud.
  const [keepLocal, setKeepLocal] = useState(false);
  const busyRef = useRef(false);
  const cart = useCart(`odr.cart.${orderId}`);

  // Polled: a diner scanning the table QR adds lines to this same order, and
  // the waiter must not fire a KOT that's missing them.
  const orderQ = useAsync(() => api.order(orderId), [orderId], 5000);
  const menuQ = useAsync(
    async () => {
      const [categories, items] = await Promise.all([
        api.categories(session.outletId),
        api.items(session.outletId),
      ]);
      return { categories, items };
    },
    [session.outletId],
  );

  const order = orderQ.data;
  const categories = menuQ.data?.categories ?? [];
  const items = menuQ.data?.items ?? [];
  const catId = activeCat ?? categories[0]?.id ?? "";

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    // A search spans the whole menu — the waiter knows the dish, not the tab.
    if (q) return items.filter((i) => i.name.toLowerCase().includes(q));
    return items.filter((i) => i.categoryId === catId);
  }, [items, catId, query]);

  const state = order?.state ?? "open";
  const sentTotal = order ? orderTotalMinor(order) : 0n;
  const pendingTotal = cart.subtotalMinor;
  const canFire = cart.items.length > 0 || state === "items_added";
  // "settled" stays actionable: it means the settle landed but the bill leg
  // didn't, and the waiter still needs the printed bill.
  const canSettle =
    (state === "kot_fired" || state === "settled") && cart.items.length === 0;

  const sendLines = async (): Promise<Order | null> => {
    if (cart.items.length === 0) return order;
    const updated = await api.addItems(
      orderId,
      cart.items.map((it) => ({
        itemId: it.itemId,
        itemName: it.itemName,
        qty: it.qty,
        unitPriceMinor: String(it.unitPriceMinor),
        taxClass: it.taxClass,
        ...(it.note ? { note: it.note } : {}),
        modifiers: it.modifiers.map((m) => ({
          id: m.id,
          name: m.name,
          priceDeltaMinor: String(m.priceDeltaMinor),
        })),
      })),
    );
    cart.clear();
    return updated;
  };

  const run = async (fn: () => Promise<unknown>) => {
    // Same reason as the tables screen: `disabled={busy}` only lands after a
    // re-render, a ref refuses the second tap immediately.
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
      orderQ.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const addToOrder = () =>
    run(async () => {
      await sendLines();
      setCartOpen(false);
      toast("Added to the order");
    });

  const fireKot = () =>
    run(async () => {
      await sendLines();
      await api.fireKot(orderId);
      setCartOpen(false);
      toast("KOT fired to the kitchen");
    });

  const voidOrder = () =>
    run(async () => {
      await api.voidOrder(orderId);
      toast("Order voided");
      navigate({ name: "tables" });
    });

  // Optional customer capture before settling — most walk-ins skip it, so it
  // must never block the till. Empty fields send nothing.
  const settle = (customer?: { customerName?: string; customerPhone?: string }) =>
    run(async () => {
      // Two calls, one intent. If the bill leg failed last time the order is
      // already settled, and retrying must reach the bill rather than dying
      // on the FSM. Billing itself is idempotent per order.
      if (order?.state !== "settled") {
        await api.settleOrder(orderId, keepLocal).catch((e: unknown) => {
          if (errorCode(e) !== "CONFLICT") throw e;
        });
      }
      const billId = keepLocal ? await settleLocally(customer) : (await api.createBill(orderId, customer)).id;
      setAskCustomer(false);
      setKeepLocal(false);
      navigate({ name: "bill", billId });
    });

  // Priced and numbered on the device, saved to IndexedDB. Settings syncs it later.
  const settleLocally = async (customer?: { customerName?: string; customerPhone?: string }) => {
    const settled = order?.state === "settled" ? order : await api.order(orderId);
    const country = session.taxCountry ?? "IN";
    const fiscalYear = fiscalYearFor(new Date(), country);
    const bill = buildLocalBill({
      id: crypto.randomUUID(),
      order: settled,
      invoiceNumber: await localBills.nextInvoiceNumber(session.invoicePrefix ?? "INV", fiscalYear),
      fiscalYear,
      country,
      settledAt: new Date().toISOString(),
      ...customer,
    });
    await localBills.put(bill);
    return bill.id;
  };

  if (orderQ.loading && !order) return <Centered>Loading the order…</Centered>;
  if (!order)
    return (
      <Centered>
        <p className="text-[var(--status-voided)]">{orderQ.error ?? "Order not found"}</p>
        <Button className="mt-4" onClick={() => navigate({ name: "tables" })}>
          Back to tables
        </Button>
      </Centered>
    );

  const channel = order.channel ?? "dine_in";
  const who = order.customerName || order.aggregatorRef;

  const cartPanel = (
    <>
      <div className="flex-1 min-h-0 overflow-auto">
        {order.lines.length > 0 ? (
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--fg-muted)] mb-1">
              Sent to the order
            </p>
            {order.lines.map((l) => (
              <div
                key={l.id}
                className="flex items-baseline justify-between gap-3 py-2 border-b border-[var(--line-subtle)] last:border-0"
              >
                <span className="text-[14px]">
                  <span className="font-mono text-[var(--fg-muted)]">{l.qty}× </span>
                  {l.itemName}
                  {l.note ? (
                    <span className="block text-[12px] italic text-[var(--status-firing)]">
                      ✱ {l.note}
                    </span>
                  ) : null}
                </span>
                <Money
                  minor={String(BigInt(l.unitPriceMinor) * BigInt(l.qty))}
                  mono
                  className="text-[14px]"
                />
              </div>
            ))}
          </div>
        ) : null}

        {cart.items.length === 0 ? (
          order.lines.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-[var(--fg-muted)]">
              Nothing added yet. Pick items from the menu.
            </p>
          ) : null
        ) : (
          <>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--fg-muted)] mb-1">
              Not sent yet
            </p>
            {cart.items.map((it, i) => (
              <CartLine
                key={`${it.itemId}-${i}`}
                name={it.itemName}
                qty={it.qty}
                unitPriceMinor={it.unitPriceMinor}
                modifiers={it.modifiers}
                isVeg={it.isVeg}
                {...(it.note !== undefined ? { note: it.note } : {})}
                onNoteChange={(v) => cart.setNote(i, v)}
                onQtyChange={(v) => cart.setQty(i, v)}
                onRemove={() => cart.remove(i)}
              />
            ))}
          </>
        )}
      </div>

      <div className="pt-4 space-y-2">
        <div className="flex justify-between text-[13px] text-[var(--fg-tertiary)]">
          <span>On the order</span>
          <Money minor={sentTotal} mono />
        </div>
        {cart.items.length > 0 ? (
          <div className="flex justify-between text-[13px] text-[var(--status-firing)]">
            <span>Pending</span>
            <Money minor={pendingTotal} mono />
          </div>
        ) : null}
        <Separator />
        <div className="flex justify-between items-baseline">
          <span className="text-[13px] font-medium">Total (pre-tax)</span>
          <Money
            minor={sentTotal + pendingTotal}
            mono
            className="text-[20px] font-semibold"
          />
        </div>
      </div>

      <div className="pt-4 grid gap-2">
        {cart.items.length > 0 ? (
          <Button size="lg" variant="secondary" onClick={addToOrder} disabled={busy}>
            <Plus size={16} /> Add {cart.totalQty} to order
          </Button>
        ) : null}
        <Button size="lg" onClick={fireKot} disabled={busy || !canFire}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Flame size={16} />}
          {state === "kot_fired" && cart.items.length === 0 ? "KOT fired" : "Fire KOT"}
        </Button>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          {session.localBilling ? (
            <HoldButton
              size="lg"
              holdMs={HOLD_MS}
              variant={canSettle ? "primary" : "outline"}
              onClick={() => { setKeepLocal(false); setAskCustomer(true); }}
              onHold={() => { setKeepLocal(true); setAskCustomer(true); }}
              disabled={busy || !canSettle}
            >
              <ReceiptText size={16} /> {state === "settled" ? "Get bill" : "Settle & bill"}
            </HoldButton>
          ) : (
            <Button
              size="lg"
              variant={canSettle ? "primary" : "outline"}
              onClick={() => setAskCustomer(true)}
              disabled={busy || !canSettle}
            >
              <ReceiptText size={16} /> {state === "settled" ? "Get bill" : "Settle & bill"}
            </Button>
          )}
          <Button
            size="lg"
            variant="outline"
            aria-label="Print KOT"
            title="Print KOT"
            onClick={() => window.print()}
            disabled={order.lines.length === 0}
          >
            <Printer size={16} />
          </Button>
        </div>
        {canManage(session.role) && state !== "settled" && state !== "voided" ? (
          <Button
            size="lg"
            variant="outline"
            className="text-[var(--status-voided)]"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Void this order${who ? ` (${who})` : ""}? This cannot be undone.`))
                voidOrder();
            }}
          >
            Void order
          </Button>
        ) : null}
      </div>
    </>
  );

  return (
    <div className="h-full flex" data-print="hide">
      {/* Menu */}
      <section className="flex-1 min-w-0 flex flex-col lg:border-r border-[var(--line-subtle)]">
        <div className="px-4 sm:px-6 py-3 flex items-center gap-3 border-b border-[var(--line-subtle)]">
          <IconButton
            label="Back to tables"
            size="sm"
            onClick={() => navigate({ name: "tables" })}
          >
            <ArrowLeft size={16} />
          </IconButton>
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-semibold tracking-[-0.01em] truncate">
              {order.tableLabel || CHANNEL_LABEL[channel]}
              {who ? <span className="text-[var(--fg-tertiary)]"> · {who}</span> : null}
            </h1>
            <p className="text-[12px] text-[var(--fg-tertiary)]">
              {order.lines.length} line{order.lines.length === 1 ? "" : "s"} sent
            </p>
          </div>
          {channel !== "dine_in" ? (
            <Badge tone={CHANNEL_TONE[channel]}>{CHANNEL_LABEL[channel]}</Badge>
          ) : null}
          <StatusPill status={state as OrderStatus} pulse={state === "items_added"} />
        </div>

        {/* Search */}
        <div className="px-4 sm:px-6 py-3 border-b border-[var(--line-subtle)]">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the menu"
              className="h-11 w-full pl-10 pr-10 rounded-[var(--radius-2)]
                         bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]
                         text-[14px] placeholder:text-[var(--fg-muted)]
                         focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                aria-label="clear"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-11 w-11 grid place-items-center text-[var(--fg-muted)]"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Categories */}
        {query ? null : (
          <div className="px-4 sm:px-6 py-2.5 flex gap-1.5 overflow-x-auto border-b border-[var(--line-subtle)]">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={
                  c.id === catId
                    ? "shrink-0 h-11 px-4 text-[14px] font-medium rounded-[var(--radius-2)] bg-[var(--accent)] text-[var(--fg-on-accent)]"
                    : "shrink-0 h-11 px-4 text-[14px] rounded-[var(--radius-2)] text-[var(--fg-secondary)] ring-1 ring-[var(--line-default)]"
                }
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Items */}
        <div className="flex-1 min-h-0 overflow-auto px-4 sm:px-6 py-4 pb-28 lg:pb-8">
          {/* A closed order takes no more items — the FSM would reject them. */}
          {state === "settled" || state === "voided" ? (
            <p className="text-[14px] text-[var(--fg-tertiary)]">
              This order is {state}. Nothing more can be added to it.
            </p>
          ) : menuQ.loading ? (
            <p className="text-[13px] text-[var(--fg-muted)]">Loading the menu…</p>
          ) : menuQ.error ? (
            <p className="text-[13px] text-[var(--status-voided)]">{menuQ.error}</p>
          ) : visibleItems.length === 0 ? (
            <p className="text-[13px] text-[var(--fg-muted)]">
              {query ? `Nothing matches "${query}".` : "This category is empty."}
            </p>
          ) : (
            <div className="grid gap-2.5 grid-cols-1 xl:grid-cols-2">
              {visibleItems.map((i) => (
                <MenuItemCard
                  key={i.id}
                  name={i.name}
                  {...(i.description ? { description: i.description } : {})}
                  basePriceMinor={decimalToMinor(i.basePrice)}
                  isVeg={i.isVeg}
                  taxClass={i.taxClass}
                  onAdd={() =>
                    cart.add({
                      itemId: i.id,
                      itemName: i.name,
                      unitPriceMinor: BigInt(decimalToMinor(i.basePrice)),
                      taxClass: i.taxClass,
                      isVeg: i.isVeg,
                      modifiers: [],
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Cart — side panel from lg, bottom sheet below it */}
      <aside className="hidden lg:flex w-[380px] shrink-0 flex-col bg-[var(--bg-surface)] px-6 py-4">
        <div className="pb-3 border-b border-[var(--line-subtle)] flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Cart</h2>
          <span className="text-[13px] text-[var(--fg-tertiary)]">
            {cart.totalQty} pending
          </span>
        </div>
        {cartPanel}
      </aside>

      {/* Mobile: thumb-reachable bar + sheet */}
      <div
        className="lg:hidden fixed left-0 right-0 bottom-0 z-30 px-4 pt-3
                   pb-[max(12px,env(safe-area-inset-bottom))]
                   bg-[var(--bg-surface)] border-t border-[var(--line-default)]
                   flex items-center gap-3"
      >
        <button
          onClick={() => setCartOpen(true)}
          className="flex-1 min-h-12 px-4 flex items-center gap-2 rounded-[var(--radius-2)]
                     ring-1 ring-[var(--line-default)] text-left"
        >
          <ShoppingBag size={16} className="text-[var(--fg-tertiary)]" />
          <span className="flex-1">
            <span className="block text-[12px] text-[var(--fg-tertiary)]">
              {cart.totalQty} pending · {order.lines.length} sent
            </span>
            <Money
              minor={sentTotal + pendingTotal}
              mono
              className="text-[15px] font-semibold"
            />
          </span>
        </button>
        <Button size="lg" className="min-h-12" onClick={fireKot} disabled={busy || !canFire}>
          <Flame size={16} /> Fire
        </Button>
      </div>

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent className="flex flex-col max-h-[86vh]">
          <SheetTitle className="mb-3">
            Cart · {order.tableLabel || CHANNEL_LABEL[channel]}
          </SheetTitle>
          {cartPanel}
        </SheetContent>
      </Sheet>

      <CustomerDialog
        open={askCustomer}
        busy={busy}
        local={keepLocal}
        onOpenChange={(v) => { setAskCustomer(v); if (!v) setKeepLocal(false); }}
        onSettle={settle}
      />

      {/* Paper */}
      <ThermalTicket
        paperWidth={session.paperWidth}
        title="KOT"
        subtitle={session.outletName}
        meta={[
          ["Table", order.tableLabel || CHANNEL_LABEL[channel]],
          ["Time", new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })],
          ...(who ? ([["For", who]] as [string, string][]) : []),
        ]}
        lines={order.lines.map((l) => ({
          name: l.itemName,
          qty: l.qty,
          note: l.note ?? null,
        }))}
      />
    </div>
  );
};

/**
 * Asked once, at settle. A phone number is what makes WhatsApp receipts and
 * repeat-customer features possible later — but a queue at the counter beats
 * data collection, so Skip is the wide button and Enter submits either way.
 */
const CustomerDialog = ({
  open,
  busy,
  local,
  onOpenChange,
  onSettle,
}: {
  open: boolean;
  busy: boolean;
  /** The bill will stay on this device. */
  local: boolean;
  onOpenChange: (v: boolean) => void;
  onSettle: (c?: { customerName?: string; customerPhone?: string }) => void;
}) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Customer details</DialogTitle>
        <DialogDescription>Optional. Skip if they are in a hurry.</DialogDescription>
        {local ? (
          <p className="mt-3 flex items-center gap-2 px-3 py-2 rounded-[var(--radius-2)] bg-[var(--accent-soft)] text-[13px] text-[var(--accent)]">
            <HardDrive size={15} /> This bill stays on this device — not in the cloud
          </p>
        ) : null}

        <form
          className="mt-5 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSettle({
              ...(name.trim() ? { customerName: name.trim() } : {}),
              ...(phone.trim() ? { customerPhone: phone.trim() } : {}),
            });
          }}
        >
          <label className="block">
            <span className="block text-[13px] font-medium text-[var(--fg-secondary)] mb-1.5">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rakesh"
              className="h-11 w-full px-3 text-[14px] rounded-[var(--radius-2)]
                         bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]
                         focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="block text-[13px] font-medium text-[var(--fg-secondary)] mb-1.5">
              Phone <span className="text-[var(--fg-muted)]">(for the bill on WhatsApp)</span>
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="98450 12345"
              className="h-11 w-full px-3 text-[14px] rounded-[var(--radius-2)]
                         bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]
                         focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </label>

          <div className="mt-2 grid grid-cols-[1fr_1fr] gap-2">
            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={busy}
              onClick={() => onSettle()}
            >
              Skip
            </Button>
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : null} Settle
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="h-full grid place-items-center px-6 text-center text-[14px] text-[var(--fg-tertiary)]">
    <div>{children}</div>
  </div>
);
