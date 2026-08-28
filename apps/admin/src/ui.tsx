/* Shared bits used by both the page and the drawer. Nothing generic. */

import type { ReactNode } from "react";
import type { Status } from "./api.ts";

export const inputClass =
  "w-full rounded-md border bg-raised px-3 py-2 text-ink transition-colors placeholder:text-muted focus:border-accent";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted">
        {label}
        {hint ? <span className="font-normal opacity-70"> · {hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function Button({
  children,
  variant = "primary",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50";
  const look =
    variant === "primary"
      ? "bg-accent text-accent-ink hover:opacity-90"
      : "border bg-raised text-ink hover:bg-surface";
  return (
    <button {...rest} className={`${base} ${look} ${rest.className ?? ""}`}>
      {children}
    </button>
  );
}

export function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-surface">
      <header className="border-b px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

const STATUS: Record<Status, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-ok-soft text-ok" },
  expiring: { label: "Expiring", className: "bg-warn-soft text-warn" },
  expired: { label: "Expired", className: "bg-bad-soft text-bad" },
  none: { label: "No subscription", className: "bg-off-soft text-off" },
};

export function StatusPill({ status }: { status: Status }) {
  const s = STATUS[status] ?? STATUS.none;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.className}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

/** Inline message strip — errors and successes, never a raw stack. */
export function Note({
  kind,
  children,
}: {
  kind: "error" | "success";
  children: ReactNode;
}) {
  const look =
    kind === "error" ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok";
  return (
    <p className={`rounded-md px-3 py-2 text-xs leading-relaxed ${look}`}>
      {children}
    </p>
  );
}

export const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
