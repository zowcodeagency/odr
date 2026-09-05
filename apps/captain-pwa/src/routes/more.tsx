import type { ReactNode } from "react";
import { ChevronRight, LogOut, Palette, QrCode, Settings, SunMoon } from "lucide-react";
import { ThemeToggle } from "@odr/ui";
import { navigate } from "../lib/router.ts";
import { canManage, clearSession, type Session } from "../lib/session.ts";
import { config } from "../lib/config.ts";

const Row = ({
  Icon,
  title,
  detail,
  onClick,
  trailing,
  danger,
}: {
  Icon: typeof Settings;
  title: string;
  detail: string;
  onClick?: () => void;
  trailing?: ReactNode;
  danger?: boolean;
}) => {
  // A row with a trailing control (theme toggle) must NOT be a button —
  // nested buttons are invalid HTML and a disabled wrapper eats the taps.
  const Tag = onClick ? "button" : "div";
  return (
  <Tag
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3 text-left
               rounded-[var(--radius-3)] bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]
               transition-colors duration-[var(--dur-quick)]
               enabled:active:bg-[var(--bg-surface-2)]"
  >
    <span
      className={`h-10 w-10 shrink-0 grid place-items-center rounded-[var(--radius-3)] ${
        danger
          ? "bg-[color-mix(in_oklab,var(--status-voided)_12%,transparent)] text-[var(--status-voided)]"
          : "bg-[var(--bg-surface-2)] text-[var(--fg-secondary)]"
      }`}
    >
      <Icon size={19} strokeWidth={1.8} />
    </span>
    <span className="min-w-0 flex-1">
      <span className={`block text-[15px] font-medium ${danger ? "text-[var(--status-voided)]" : ""}`}>
        {title}
      </span>
      <span className="block text-[12px] text-[var(--fg-tertiary)] truncate">{detail}</span>
    </span>
    {trailing ?? (onClick ? <ChevronRight size={18} className="text-[var(--fg-muted)]" /> : null)}
  </Tag>
  );
};

/** The bottom-nav overflow screen — everything that isn't a main tab. */
export const MoreRoute = ({ session }: { session: Session }) => {
  const manage = canManage(session.role);
  return (
    <div className="max-w-lg mx-auto p-4 space-y-3">
      <div className="flex items-center gap-3 px-4 py-4 rounded-[var(--radius-3)] bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]">
        <span
          className="h-12 w-12 shrink-0 grid place-items-center rounded-full
                     bg-[var(--accent-soft)] text-[var(--accent)] text-[18px] font-semibold uppercase"
        >
          {session.email.slice(0, 1)}
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-medium truncate">{session.email}</span>
          <span className="block text-[12px] text-[var(--fg-tertiary)] truncate">
            {session.role} · {session.outletName}
          </span>
        </span>
      </div>

      {manage ? (
        <Row
          Icon={Settings}
          title="Settings"
          detail="Outlet, tables, printing and staff"
          onClick={() => navigate({ name: "settings" })}
        />
      ) : null}
      {session.role === "owner" ? (
        <Row
          Icon={Palette}
          title="Branding"
          detail="Your logo, colors, font and layout"
          onClick={() => navigate({ name: "branding" })}
        />
      ) : null}
      {manage && !config().offline ? (
        <Row
          Icon={QrCode}
          title="Print QR sheet"
          detail="Printable table QR codes"
          onClick={() => navigate({ name: "qr" })}
        />
      ) : null}
      <Row Icon={SunMoon} title="Appearance" detail="Light or dark theme" trailing={<ThemeToggle />} />
      <Row
        Icon={LogOut}
        title="Sign out"
        detail="End this shift on this device"
        danger
        onClick={() => {
          clearSession();
          navigate({ name: "login" });
        }}
      />
    </div>
  );
};
