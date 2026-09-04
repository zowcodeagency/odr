import { useEffect, useState } from "react";
import { NetworkPill, ThemeToggle } from "@odr/ui";
import type { Session } from "../lib/session.ts";
import { BrandMark } from "./logo.tsx";
import { OutletSwitcher } from "./outlet-switcher.tsx";

interface TopbarProps {
  session: Session;
}

/** Identity + status only — navigation lives in the rail (desktop) and the bottom bar (phone). */
export const Topbar = ({ session }: TopbarProps) => {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return (
    <header
      className="shrink-0 px-3 sm:px-5 h-14 flex items-center gap-2
                 border-b border-[var(--line-subtle)] bg-[var(--bg-canvas)]"
      data-print="hide"
    >
      <span className="md:hidden">
        <BrandMark />
      </span>

      <OutletSwitcher session={session} />

      <div className="flex-1" />

      <NetworkPill state={online ? "online" : "offline"} />
      <span className="hidden md:inline-flex">
        <ThemeToggle />
      </span>
    </header>
  );
};
