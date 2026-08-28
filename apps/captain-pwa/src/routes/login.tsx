import { useEffect, useState } from "react";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { Button, Input, ThemeToggle } from "@odr/ui";
import { api, needsTenant } from "../lib/api.ts";
import { navigate } from "../lib/router.ts";
import { addressLine, clearSession, setSession } from "../lib/session.ts";
import { Logo } from "../shell/logo.tsx";
import { LoginServiceLoop } from "./login-service-loop.tsx";

const FACTS = [
  ["Runs on the phone", "The floor, the kitchen and the bill in one hand."],
  ["GST-compliant", "Tax broken out per component and rate, never collapsed."],
  ["No lock-in", "Every bill exports as CSV, JSON or e-invoice XML."],
];

type Tenant = { id: string; name: string };

declare global {
  interface Window {
    __ODR_INSTALL?: Event & { prompt: () => Promise<unknown> };
  }
}

/** Native one-tap install button; renders nothing once installed or unsupported. */
const InstallButton = () => {
  const [ready, setReady] = useState(() => Boolean(window.__ODR_INSTALL));
  useEffect(() => {
    const on = () => setReady(true);
    window.addEventListener("odr:installable", on);
    return () => window.removeEventListener("odr:installable", on);
  }, []);
  if (!ready || matchMedia("(display-mode: standalone)").matches) return null;
  return (
    <Button
      type="button"
      size="lg"
      variant="secondary"
      className="mt-3 w-full"
      onClick={() => {
        void window.__ODR_INSTALL?.prompt().finally(() => {
          window.__ODR_INSTALL = undefined;
          setReady(false);
        });
      }}
    >
      <Download size={16} /> Install app
    </Button>
  );
};

export const LoginRoute = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (tenantId?: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.login(email.trim(), password, tenantId);
      if (needsTenant(res)) {
        setTenants(res.tenants);
        return;
      }
      // Token must be stored before the outlet lookup — api.ts reads it.
      setSession({
        token: res.token,
        userId: res.user.id,
        email: res.user.email,
        role: res.role,
        outletId: "",
        outletName: "",
        paperWidth: 80,
        subscriptionEndsAt: res.subscriptionEndsAt,
      });
      const outlets = await api.outlets();
      const outlet = outlets[0];
      if (!outlet) {
        clearSession();
        setError("This account has no outlet yet. Ask Odr to finish setup.");
        return;
      }
      setSession({
        token: res.token,
        userId: res.user.id,
        email: res.user.email,
        role: res.role,
        outletId: outlet.id,
        outletName: outlet.name,
        outletGstin: outlet.gstin ?? null,
        outletAddress: addressLine(outlet.address),
        paperWidth: outlet.paperWidth ?? 80,
        printerIp: outlet.printerIp ?? null,
        printerPort: outlet.printerPort ?? 9100,
        subscriptionEndsAt: res.subscriptionEndsAt,
      });
      navigate({ name: "tables" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full grid grid-cols-1 lg:grid-cols-[1fr_460px] bg-[var(--bg-canvas)]">
      {/* Left — quiet context panel */}
      <section className="hidden lg:flex min-h-screen flex-col overflow-hidden border-r border-[var(--line-subtle)] p-12">
        <Logo size={28} wordmark />

        <div className="grid flex-1 items-center gap-10 xl:grid-cols-[minmax(340px,440px)_minmax(300px,1fr)] 2xl:gap-16">
          <div className="max-w-[440px]">
            <h1 className="text-[34px] font-semibold leading-[1.15] tracking-[-0.025em]">
              Point of sale for restaurants that run on rhythm.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--fg-tertiary)]">
              Open the floor, fire the kitchen, settle the bill.
            </p>

            <dl className="mt-12 space-y-5">
              {FACTS.map(([term, def]) => (
                <div key={term} className="border-t border-[var(--line-subtle)] pt-4">
                  <dt className="text-[13px] font-medium text-[var(--fg-primary)]">{term}</dt>
                  <dd className="mt-1 text-[13px] text-[var(--fg-tertiary)]">{def}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="hidden xl:block">
            <LoginServiceLoop />
          </div>
        </div>

        <p className="text-[12px] text-[var(--fg-muted)] font-mono">
          v1.0 · FY 2026–27 · Made in Mangaluru
        </p>
      </section>

      {/* Right — sign-in */}
      <section className="flex flex-col justify-center px-6 py-8 lg:px-12 bg-[var(--bg-surface)]">
        <div className="flex items-center justify-between lg:justify-end">
          <span className="lg:hidden">
            <Logo size={28} wordmark />
          </span>
          <ThemeToggle />
        </div>

        {tenants ? (
          <div className="w-full max-w-[340px] mx-auto my-auto py-10">
            <button
              onClick={() => setTenants(null)}
              className="inline-flex items-center gap-1.5 text-[13px] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] min-h-11"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">
              Choose a restaurant
            </h2>
            <p className="mt-1.5 text-[14px] text-[var(--fg-tertiary)]">
              This account works at more than one.
            </p>
            <div className="mt-6 grid gap-2">
              {tenants.map((t) => (
                <button
                  key={t.id}
                  disabled={busy}
                  onClick={() => void signIn(t.id)}
                  className="min-h-12 px-4 text-left text-[15px] font-medium
                             rounded-[var(--radius-2)] bg-[var(--bg-canvas)]
                             ring-1 ring-[var(--line-default)]
                             hover:bg-[var(--bg-surface-2)] disabled:opacity-50"
                >
                  {t.name}
                </button>
              ))}
            </div>
            {error ? (
              <p className="mt-4 text-[13px] text-[var(--status-voided)]">{error}</p>
            ) : null}
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void signIn();
            }}
            className="w-full max-w-[340px] mx-auto my-auto py-10"
          >
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Sign in</h2>
            <p className="mt-1.5 text-[14px] text-[var(--fg-tertiary)]">
              Use your Odr credentials.
            </p>

            <div className="mt-8 space-y-4">
              <label className="block">
                <span className="block text-[13px] font-medium text-[var(--fg-secondary)] mb-1.5">
                  Email
                </span>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="h-11"
                />
              </label>
              <label className="block">
                <span className="block text-[13px] font-medium text-[var(--fg-secondary)] mb-1.5">
                  Password
                </span>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-11"
                />
              </label>
            </div>

            {error ? (
              <p className="mt-4 text-[13px] text-[var(--status-voided)]">{error}</p>
            ) : null}

            <Button type="submit" size="lg" disabled={busy} className="mt-7 w-full">
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {busy ? "Signing in" : "Begin shift"}
            </Button>

            <InstallButton />
          </form>
        )}
      </section>
    </div>
  );
};
