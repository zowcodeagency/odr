import { AlertTriangle } from "lucide-react";
import { navigate } from "../lib/router.ts";
import { clearSession, formatEndDate } from "../lib/session.ts";
import { Logo } from "./logo.tsx";

/** Slim warning strip — shown from 7 days out. */
export const SubscriptionBanner = ({ endsAt }: { endsAt: string }) => (
  <div
    role="status"
    className="shrink-0 flex items-center gap-2 px-5 py-2
               border-b border-[var(--line-subtle)]
               bg-[color-mix(in_oklab,var(--status-firing)_14%,var(--bg-canvas))]
               text-[13px] text-[var(--fg-primary)]"
  >
    <AlertTriangle size={14} className="text-[var(--status-firing)] shrink-0" />
    <span>
      Your plan ends on{" "}
      <span className="font-medium">{formatEndDate(endsAt)}</span> — contact Odr
      to renew
    </span>
  </div>
);

/** Terminal state. No navigation, no data — just the fact and who to call. */
export const SubscriptionEnded = () => (
  <div className="h-full grid place-items-center px-6 bg-[var(--bg-canvas)]">
    <div className="text-center">
      <Logo size={40} className="justify-center" />
      <h1 className="mt-7 text-[24px] font-semibold tracking-[-0.02em]">
        Subscription ended
      </h1>
      <p className="mt-2 text-[15px] text-[var(--fg-tertiary)]">
        Contact Odr to renew
      </p>
      <button
        onClick={() => {
          clearSession();
          navigate({ name: "login" });
        }}
        className="mt-7 min-h-11 px-5 text-[14px] rounded-[var(--radius-2)] ring-1 ring-[var(--line-default)] hover:bg-[var(--bg-surface-2)]"
      >
        Sign out
      </button>
    </div>
  </div>
);
