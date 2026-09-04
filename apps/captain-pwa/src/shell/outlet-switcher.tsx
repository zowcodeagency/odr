import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle, cn } from "@odr/ui";
import { api } from "../lib/api.ts";
import { navigate } from "../lib/router.ts";
import { toast } from "../lib/toast.tsx";
import { outletPatch, patchSession, rememberOutlet, type Session } from "../lib/session.ts";

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

/**
 * The identity block in the topbar: outlet on the first line, who is signed in
 * on the second. With several outlets the whole block is a button that opens
 * the switcher. Switching patches the session — every screen keys its data on
 * session.outletId, so the floor, kitchen and sales refetch on their own.
 */
export const OutletSwitcher = ({ session }: { session: Session }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const many = session.outlets.length > 1;

  const pick = async (id: string) => {
    if (id === session.outletId) return setOpen(false);
    setBusy(id);
    try {
      const outlet = (await api.outlets()).find((o) => o.id === id && o.isActive);
      if (!outlet) throw new Error("That outlet is no longer available");
      rememberOutlet(id);
      patchSession(outletPatch(outlet));
      setOpen(false);
      navigate({ name: "tables" });
      toast(`Now working at ${outlet.name}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not switch outlet");
    } finally {
      setBusy(null);
    }
  };

  const who = (
    <span className="block text-[12px] leading-4 text-[var(--fg-tertiary)] truncate">
      {session.email} · {session.role}
    </span>
  );

  if (!many) {
    return (
      <div className="min-w-0">
        <span className="block text-[14px] leading-5 font-medium tracking-[-0.01em] truncate">{session.outletName}</span>
        {who}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Switch outlet (currently ${session.outletName})`}
        className="min-w-0 flex items-center gap-2 h-11 -mx-2 px-2 text-left rounded-[var(--radius-2)]
                   transition-colors duration-[var(--dur-quick)] hover:bg-[var(--bg-surface-2)] active:bg-[var(--bg-surface-3)]"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-[14px] leading-5 font-medium tracking-[-0.01em]">
            <span className="truncate">{session.outletName}</span>
            <ChevronsUpDown size={14} className="shrink-0 text-[var(--fg-muted)]" />
          </span>
          {who}
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>Switch outlet</SheetTitle>
          <SheetDescription>The floor, kitchen and sales screens follow the outlet you pick.</SheetDescription>
          <ul className="mt-4 -mx-1 grid gap-1 overflow-y-auto">
            {session.outlets.map((o) => {
              const active = o.id === session.outletId;
              return (
                <li key={o.id}>
                  <button
                    onClick={() => void pick(o.id)}
                    disabled={busy !== null}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "w-full flex items-center gap-3 min-h-14 px-3 text-left rounded-[var(--radius-3)]",
                      "transition-colors duration-[var(--dur-quick)] disabled:opacity-60",
                      active ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--bg-surface-2)] active:bg-[var(--bg-surface-3)]",
                    )}
                  >
                    <span
                      className={cn(
                        "h-10 w-10 shrink-0 grid place-items-center rounded-full text-[13px] font-semibold",
                        active ? "bg-[var(--accent)] text-[var(--fg-on-accent)]" : "bg-[var(--bg-surface-2)] text-[var(--fg-secondary)] ring-1 ring-[var(--line-default)]",
                      )}
                    >
                      {initials(o.name)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-medium truncate">{o.name}</span>
                      <span className="block text-[12px] text-[var(--fg-tertiary)]">
                        {active ? "Working here now" : "Tap to switch"}
                      </span>
                    </span>
                    {busy === o.id ? (
                      <Loader2 size={18} className="shrink-0 animate-spin text-[var(--fg-muted)]" />
                    ) : active ? (
                      <Check size={18} className="shrink-0 text-[var(--accent)]" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
};
