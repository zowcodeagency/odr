import { BookOpen, ChefHat, Grid3x3, LogOut, Palette, ReceiptText, Settings } from "lucide-react";
import { cn } from "@odr/ui";
import { navigate, type Route, useRoute } from "../lib/router.ts";
import { clearSession } from "../lib/session.ts";
import { BrandMark } from "./logo.tsx";

interface RailItem {
  to: Route;
  label: string;
  Icon: typeof Grid3x3;
}

const ITEMS: RailItem[] = [
  { to: { name: "tables" }, label: "Tables", Icon: Grid3x3 },
  { to: { name: "kds" }, label: "Kitchen", Icon: ChefHat },
];

/** Editing the menu needs menu:write — owner and manager only. */
const SALES_ITEMS: RailItem[] = [{ to: { name: "bills" }, label: "Sales", Icon: ReceiptText }];
const MANAGE_ITEMS: RailItem[] = [{ to: { name: "menu" }, label: "Menu", Icon: BookOpen }];

const railButton = (active: boolean) =>
  cn(
    "relative h-11 w-11 grid place-items-center rounded-[var(--radius-2)]",
    "transition-colors duration-[var(--dur-quick)]",
    active
      ? "bg-[var(--bg-surface-2)] text-[var(--fg-primary)]"
      : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-surface-2)]",
  );

/** Desktop only — the phone gets the same shortcuts in the topbar. */
export const NavRail = ({ canManage, canSeeSales, isOwner }: { canManage: boolean; canSeeSales: boolean; isOwner: boolean }) => {
  const route = useRoute();
  return (
    <nav
      aria-label="primary"
      data-print="hide"
      className="hidden md:flex w-14 shrink-0 h-full flex-col items-center py-3 gap-1
                 border-r border-[var(--line-subtle)] bg-[var(--bg-surface)]"
    >
      <a href="#/tables" aria-label="Odr" className="mb-2">
        <BrandMark size={28} />
      </a>

      {[
        ...ITEMS,
        ...(canSeeSales ? SALES_ITEMS : []),
        ...(canManage ? MANAGE_ITEMS : []),
      ].map(({ to, label, Icon }) => {
        const active = route.name === to.name;
        return (
          <button
            key={label}
            aria-label={label}
            title={label}
            onClick={() => navigate(to)}
            className={railButton(active)}
          >
            <Icon size={18} strokeWidth={1.8} />
            {active ? (
              <span className="absolute -left-2 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-r bg-[var(--accent)]" />
            ) : null}
          </button>
        );
      })}

      <div className="flex-1" />

      {isOwner ? (
        <button
          aria-label="Branding"
          title="Branding"
          onClick={() => navigate({ name: "branding" })}
          className={railButton(route.name === "branding")}
        >
          <Palette size={18} strokeWidth={1.8} />
        </button>
      ) : null}
      {canManage ? (
        <button
          aria-label="Settings"
          title="Settings"
          onClick={() => navigate({ name: "settings" })}
          className={railButton(route.name === "settings" || route.name === "qr")}
        >
          <Settings size={18} strokeWidth={1.8} />
        </button>
      ) : null}
      <button
        aria-label="Sign out"
        title="Sign out"
        onClick={() => {
          clearSession();
          navigate({ name: "login" });
        }}
        className={railButton(false)}
      >
        <LogOut size={18} strokeWidth={1.8} />
      </button>
    </nav>
  );
};
