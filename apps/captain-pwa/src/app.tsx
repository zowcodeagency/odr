import { useEffect, useState } from "react";
import { api } from "./lib/api.ts";
import { useRoute } from "./lib/router.ts";
import { getSession, isExpired, patchSession, SESSION_EVENT, type Session } from "./lib/session.ts";
import { applyBranding, getStoredBranding, storeBranding } from "./lib/branding.ts";
import { Toaster } from "./lib/toast.tsx";
import { AppShell } from "./shell/app-shell.tsx";
import { SubscriptionEnded } from "./shell/subscription.tsx";
import { LoginRoute } from "./routes/login.tsx";
import { TablesRoute } from "./routes/tables.tsx";
import { OrderRoute } from "./routes/order.tsx";
import { BillRoute } from "./routes/bill.tsx";
import { KdsRoute } from "./routes/kds.tsx";
import { SettingsRoute } from "./routes/settings.tsx";
import { MenuRoute } from "./routes/menu.tsx";
import { BillsRoute } from "./routes/bills.tsx";
import { QrSheetRoute } from "./routes/qr-sheet.tsx";
import { MoreRoute } from "./routes/more.tsx";
import { BrandingRoute } from "./routes/branding.tsx";

export const App = () => {
  const route = useRoute();
  // Re-read on every navigation: login, sign-out and 401s all go through the
  // hash, so there is no second source of truth to keep in sync.
  const [session, setSession] = useState<Session | null>(() => getSession());
  useEffect(() => setSession(getSession()), [route]);
  useEffect(() => {
    const on = () => setSession(getSession());
    window.addEventListener(SESSION_EVENT, on);
    return () => window.removeEventListener(SESSION_EVENT, on);
  }, []);

  // Refresh the subscription window and branding from the API once per boot —
  // the stored copies are snapshots from sign-in.
  useEffect(() => {
    if (!session) return;
    void api
      .me()
      .then((me) => {
        const flags = { localBilling: me.localBilling ?? false, taxCountry: me.taxCountry ?? "IN" };
        if (
          me.subscriptionEndsAt !== session.subscriptionEndsAt ||
          flags.localBilling !== (session.localBilling ?? false) ||
          flags.taxCountry !== session.taxCountry
        ) {
          patchSession({ subscriptionEndsAt: me.subscriptionEndsAt, ...flags });
          setSession(getSession());
        }
      })
      .catch(() => undefined);
    void api
      .branding()
      .then((b) => {
        if (JSON.stringify(b) !== JSON.stringify(getStoredBranding())) {
          storeBranding(b);
          applyBranding(b);
        }
      })
      .catch(() => undefined);
    void api
      .outlets()
      .then((list) => {
        const outlets = list.filter((o) => o.isActive).map((o) => ({ id: o.id, name: o.name }));
        if (JSON.stringify(outlets) !== JSON.stringify(session.outlets)) {
          patchSession({ outlets });
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  if (!session || route.name === "login")
    return (
      <>
        <LoginRoute />
        <Toaster />
      </>
    );

  // Past the subscription window nothing else renders — matching the API's
  // 403 SUBSCRIPTION_EXPIRED, which would fail every request anyway.
  if (isExpired(session.subscriptionEndsAt)) return <SubscriptionEnded />;

  // The KDS goes full-bleed outside the shell — it mounts on a kitchen TV.
  if (route.name === "kds")
    return (
      <>
        <KdsRoute session={session} />
        <Toaster />
      </>
    );

  return (
    <>
      <AppShell session={session}>
        {route.name === "tables"   ? <TablesRoute   session={session} /> : null}
        {route.name === "order"    ? <OrderRoute    session={session} orderId={route.orderId} /> : null}
        {route.name === "bill"     ? <BillRoute     session={session} billId={route.billId} /> : null}
        {route.name === "settings" ? <SettingsRoute session={session} /> : null}
        {route.name === "menu"     ? <MenuRoute     session={session} /> : null}
        {route.name === "bills"    ? <BillsRoute    session={session} /> : null}
        {route.name === "qr"       ? <QrSheetRoute  session={session} /> : null}
        {route.name === "more"     ? <MoreRoute     session={session} /> : null}
        {route.name === "branding" ? <BrandingRoute session={session} /> : null}
      </AppShell>
      <Toaster />
    </>
  );
};
