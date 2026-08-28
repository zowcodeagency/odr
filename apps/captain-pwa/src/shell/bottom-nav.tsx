import { BookOpen, ChefHat, Grid3x3, Menu as MoreIcon, ReceiptText } from "lucide-react";
import { cn } from "@odr/ui";
import { navigate, type Route, useRoute } from "../lib/router.ts";
import { canManage, canSeeSales } from "../lib/session.ts";

interface Tab {
  to: Route;
  label: string;
  Icon: typeof Grid3x3;
  /** Routes that keep this tab highlighted besides its own. */
  also?: Route["name"][];
}

/** Same role gates as the desktop rail — a dead-end tap is still a bug. */
const tabs = (role: string): Tab[] => [
  { to: { name: "tables" }, label: "Tables", Icon: Grid3x3, also: ["order", "bill"] },
  { to: { name: "kds" }, label: "Kitchen", Icon: ChefHat },
  ...(canSeeSales(role) ? [{ to: { name: "bills" } as Route, label: "Sales", Icon: ReceiptText }] : []),
  ...(canManage(role) ? [{ to: { name: "menu" } as Route, label: "Menu", Icon: BookOpen }] : []),
  { to: { name: "more" }, label: "More", Icon: MoreIcon, also: ["settings", "qr", "branding"] },
];

/** Phone only — desktop keeps the left rail. */
export const BottomNav = ({ role }: { role: string }) => {
  const route = useRoute();
  return (
    <nav
      aria-label="primary"
      data-print="hide"
      className="md:hidden shrink-0 flex items-stretch justify-around
                 border-t border-[var(--line-subtle)] bg-[var(--bg-surface)]
                 pt-1 pb-[max(4px,env(safe-area-inset-bottom))]"
    >
      {tabs(role).map(({ to, label, Icon, also }) => {
        const active = route.name === to.name || (also?.includes(route.name) ?? false);
        return (
          <button
            key={label}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            onClick={() => navigate(to)}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 pt-1.5 pb-1",
              "transition-colors duration-[var(--dur-quick)]",
              active ? "text-[var(--accent)]" : "text-[var(--fg-muted)]",
            )}
          >
            <span
              className={cn(
                "px-4 py-1 rounded-[var(--radius-pill)]",
                "transition-colors duration-[var(--dur-quick)]",
                active ? "bg-[var(--accent-soft)]" : "bg-transparent",
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.1 : 1.8} />
            </span>
            <span className="text-[11px] font-medium leading-none">{label}</span>
          </button>
        );
      })}
    </nav>
  );
};
