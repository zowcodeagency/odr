import { Cloud, CloudOff, RefreshCcw } from "lucide-react";
import { cn } from "../lib/cn.ts";

export type NetworkState = "online" | "offline" | "syncing";

const COPY: Record<NetworkState, string> = {
  online: "Connected",
  offline: "Working offline",
  syncing: "Syncing",
};

/**
 * Calm offline indicator. Brief §14, rule #4 — never lock the captain when
 * the network drops. This pill changes color and copy, that's it.
 */
export const NetworkPill = ({
  state,
  pendingCount,
  className,
}: {
  state: NetworkState;
  pendingCount?: number;
  className?: string;
}) => {
  const Icon = state === "online" ? Cloud : state === "syncing" ? RefreshCcw : CloudOff;
  const tone =
    state === "online"
      ? "text-[var(--status-settled)]"
      : state === "syncing"
        ? "text-[var(--status-firing)]"
        : "text-[var(--fg-tertiary)]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 px-2.5 h-8",
        "text-[12px] font-medium",
        "rounded-[var(--radius-pill)]",
        "bg-[var(--bg-surface-2)] ring-1 ring-[var(--line-subtle)]",
        tone,
        className,
      )}
    >
      <Icon
        size={14}
        className={state === "syncing" ? "animate-spin [animation-duration:1.6s]" : undefined}
      />
      <span className="text-[var(--fg-secondary)]">{COPY[state]}</span>
      {state !== "online" && pendingCount && pendingCount > 0 ? (
        <span className="font-mono text-[var(--fg-primary)]">· {pendingCount}</span>
      ) : null}
    </span>
  );
};
