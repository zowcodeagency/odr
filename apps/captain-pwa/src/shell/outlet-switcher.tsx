import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, cn } from "@odr/ui";
import { api } from "../lib/api.ts";
import { navigate } from "../lib/router.ts";
import { toast } from "../lib/toast.tsx";
import { outletPatch, patchSession, rememberOutlet, type Session } from "../lib/session.ts";

/**
 * Outlet name in the topbar. With one outlet it is plain text; with several
 * it opens a bottom sheet. Switching patches the session — every screen keys
 * its data on session.outletId, so the floor, kitchen and sales refetch.
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

  if (!many) {
    return <span className="block text-[14px] font-medium tracking-[-0.01em] truncate">{session.outletName}</span>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Switch outlet (currently ${session.outletName})`}
        className="flex items-center gap-1 min-h-11 -ml-1 px-1 rounded-[var(--radius-2)]
                   text-[14px] font-medium tracking-[-0.01em] hover:bg-[var(--bg-surface-2)]"
      >
        <span className="truncate">{session.outletName}</span>
        <ChevronDown size={14} className="shrink-0 text-[var(--fg-muted)]" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="max-w-lg mx-auto">
          <SheetTitle>Switch outlet</SheetTitle>
          <ul className="mt-4 grid gap-2">
            {session.outlets.map((o) => {
              const active = o.id === session.outletId;
              return (
                <li key={o.id}>
                  <button
                    onClick={() => void pick(o.id)}
                    disabled={busy !== null}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "w-full flex items-center gap-3 min-h-12 px-4 text-left text-[15px] rounded-[var(--radius-2)]",
                      "ring-1 ring-[var(--line-default)] disabled:opacity-60",
                      active ? "bg-[var(--accent-soft)] font-medium" : "bg-[var(--bg-canvas)] hover:bg-[var(--bg-surface-2)]",
                    )}
                  >
                    <span className="flex-1 truncate">{o.name}</span>
                    {busy === o.id ? <Loader2 size={16} className="animate-spin" /> : active ? <Check size={16} className="text-[var(--accent)]" /> : null}
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
