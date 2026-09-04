import type { ReactNode } from "react";
import { canManage, canSeeSales, daysRemaining, type Session } from "../lib/session.ts";
import { BottomNav } from "./bottom-nav.tsx";
import { NavRail } from "./nav-rail.tsx";
import { SubscriptionBanner } from "./subscription.tsx";
import { Topbar } from "./topbar.tsx";

export const AppShell = ({
  session,
  children,
}: {
  session: Session;
  children: ReactNode;
}) => {
  const days = daysRemaining(session.subscriptionEndsAt);
  const warn = session.subscriptionEndsAt !== null && days !== null && days <= 7;

  return (
    <div
      className="h-full flex bg-[var(--bg-canvas)] [--bottom-nav-h:calc(56px_+_env(safe-area-inset-bottom))] md:[--bottom-nav-h:0px]"
    >
      <NavRail canManage={canManage(session.role)} canSeeSales={canSeeSales(session.role)} isOwner={session.role === "owner"} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar session={session} />
        {warn ? <SubscriptionBanner endsAt={session.subscriptionEndsAt as string} /> : null}
        <main className="flex-1 min-h-0 overflow-auto">{children}</main>
        <BottomNav role={session.role} />
      </div>
    </div>
  );
};
