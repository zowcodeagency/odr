/*
 * Owner branding — its own screen, reached from More (phone) and the rail
 * (desktop). Colors, font, logo, theme, style variant, plus the floor layout.
 */
import { useEffect, useState } from "react";
import { ChevronDown, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@odr/ui";
import { api } from "../lib/api.ts";
import { toast } from "../lib/toast.tsx";
import type { Session } from "../lib/session.ts";
import {
  DEFAULT_BRANDING,
  FLOOR_LAYOUTS,
  FONTS,
  STYLES,
  applyBranding,
  autoOnColor,
  fileToLogo,
  getFloorLayout,
  getStoredBranding,
  setFloorLayout,
  storeBranding,
  type Branding,
  type FloorLayout,
} from "../lib/branding.ts";

const Section = ({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-[var(--radius-3)] ring-1 ring-[var(--line-default)] bg-[var(--bg-surface)] overflow-hidden">
    <header className="px-5 py-3.5 border-b border-[var(--line-subtle)]">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
      {hint ? <p className="mt-0.5 text-[13px] text-[var(--fg-tertiary)]">{hint}</p> : null}
    </header>
    <div className="p-5">{children}</div>
  </section>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <span className="block text-[13px] font-medium text-[var(--fg-secondary)] mb-1.5">
      {label}
    </span>
    {children}
  </div>
);

/* -------------------------------------------------------------- branding -- */

const Swatch = ({
  label,
  hint,
  value,
  onChange,
  onAuto,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  /** Shown as an "Auto" chip when the value is a manual override. */
  onAuto?: () => void;
}) => (
  <label className="flex items-center gap-3 p-3 rounded-[var(--radius-2)] ring-1 ring-[var(--line-default)] cursor-pointer">
    {/* Native color input — the OS picker works on every phone and desktop. */}
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-11 shrink-0 rounded-[var(--radius-1)] border-0 bg-transparent cursor-pointer"
    />
    <span className="min-w-0">
      <span className="block text-[14px] font-medium">{label}</span>
      <span className="block text-[12px] text-[var(--fg-tertiary)]">{hint}</span>
    </span>
    <span className="ml-auto flex items-center gap-2">
      {onAuto ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onAuto();
          }}
          className="text-[12px] px-2.5 h-11 rounded-[var(--radius-pill)] ring-1 ring-[var(--line-default)] text-[var(--fg-secondary)]"
        >
          Auto
        </button>
      ) : null}
      <span className="text-[12px] font-mono text-[var(--fg-muted)] uppercase">{value}</span>
    </span>
  </label>
);

export const BrandingRoute = ({ session }: { session: Session }) => {
  // Spread over defaults: blobs saved before newer fields existed stay valid.
  const [draft, setDraft] = useState<Branding>(() => ({
    ...DEFAULT_BRANDING,
    ...getStoredBranding(),
  }));
  const [busy, setBusy] = useState(false);

  // Every change previews live on the whole app; leaving without saving
  // snaps back to what's actually saved.
  const patch = (p: Partial<Branding>) => {
    const next = { ...draft, ...p };
    setDraft(next);
    applyBranding(next);
  };
  useEffect(() => () => applyBranding(getStoredBranding()), []);

  const save = async () => {
    setBusy(true);
    try {
      await api.saveBranding(draft);
      storeBranding(draft);
      toast("Branding saved — everyone sees it on their next open");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save branding");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await api.resetBranding();
      storeBranding(null);
      applyBranding(null);
      setDraft(DEFAULT_BRANDING);
      toast("Back to the standard Odr look");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not reset");
    } finally {
      setBusy(false);
    }
  };

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    try {
      patch({ logo: await fileToLogo(file) });
    } catch {
      toast("Couldn't read that image — try a PNG or JPG");
    }
  };

  if (session.role !== "owner") {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-[15px] font-medium">Branding is set by the owner</p>
        <p className="mt-1.5 text-[13px] text-[var(--fg-tertiary)]">
          Ask them to change the logo, colors or layout.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-7 lg:px-10 max-w-[900px] mx-auto grid gap-5">
      <header>
        <h1 className="text-[20px] sm:text-[22px] font-semibold tracking-[-0.02em]">Branding</h1>
        <p className="mt-1 text-[13px] text-[var(--fg-tertiary)]">
          Make the app yours — everything previews instantly.
        </p>
      </header>

    <Section
      title="Your branding"
      hint="Colors, font and logo apply to every screen, for every staff member."
    >
      <div className="grid gap-5">
        <Field label="Logo">
          <div className="flex items-center gap-3">
            <span className="h-14 w-24 grid place-items-center rounded-[var(--radius-2)] ring-1 ring-[var(--line-default)] bg-[var(--bg-surface-2)] overflow-hidden">
              {draft.logo ? (
                <img src={draft.logo} alt="Your logo" className="max-h-12 max-w-[88px] object-contain" />
              ) : (
                <span className="text-[11px] text-[var(--fg-muted)]">No logo</span>
              )}
            </span>
            <label className="h-11 px-4 inline-flex items-center text-[14px] rounded-[var(--radius-2)] ring-1 ring-[var(--line-default)] cursor-pointer">
              <ImagePlus size={15} className="mr-1.5" /> Upload
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => void pickLogo(e.target.files?.[0])}
              />
            </label>
            {draft.logo ? (
              <Button variant="outline" size="lg" onClick={() => patch({ logo: null })}>
                Remove
              </Button>
            ) : null}
          </div>
        </Field>

        <div className="grid gap-2 sm:grid-cols-2">
          <Swatch
            label="Primary"
            hint="Buttons & highlights"
            value={draft.primary}
            onChange={(v) => patch({ primary: v, onPrimary: draft.onPrimary ?? null })}
          />
          <Swatch
            label="Button text"
            hint={draft.onPrimary ? "Your pick" : "Auto — follows primary"}
            value={draft.onPrimary ?? autoOnColor(draft.primary)}
            onChange={(v) => patch({ onPrimary: v })}
            onAuto={draft.onPrimary ? () => patch({ onPrimary: null }) : undefined}
          />
          <Swatch
            label="Secondary"
            hint="Background tint"
            value={draft.secondary}
            onChange={(v) => patch({ secondary: v })}
          />
          <Swatch
            label="Headings"
            hint="Optional text accent"
            value={draft.tertiary ?? draft.primary}
            onChange={(v) => patch({ tertiary: v })}
          />
        </div>

        <Field label="Style">
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-5">
            {STYLES.map((st) => (
              <button
                key={st.key}
                type="button"
                title={st.hint}
                onClick={() => patch({ style: st.key })}
                className={
                  (draft.style ?? "classic") === st.key
                    ? "h-11 text-[14px] font-medium rounded-[var(--radius-2)] bg-[var(--accent)] text-[var(--fg-on-accent)]"
                    : "h-11 text-[14px] rounded-[var(--radius-2)] ring-1 ring-[var(--line-default)]"
                }
              >
                {st.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[12px] text-[var(--fg-tertiary)]">
            {STYLES.find((st) => st.key === (draft.style ?? "classic"))?.hint}
          </p>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Font">
            <span className="relative block">
              <select
                value={draft.font}
                onChange={(e) => patch({ font: e.target.value })}
                className="appearance-none h-11 w-full pl-3 pr-9 text-[14px] rounded-[var(--radius-2)]
                           bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]
                           focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                {FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
            </span>
          </Field>
          <Field label="Theme">
            <div className="flex gap-2">
              {(["light", "dark", "auto"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => patch({ theme: t })}
                  className={
                    draft.theme === t
                      ? "flex-1 h-11 text-[14px] font-medium capitalize rounded-[var(--radius-2)] bg-[var(--accent)] text-[var(--fg-on-accent)]"
                      : "flex-1 h-11 text-[14px] capitalize rounded-[var(--radius-2)] ring-1 ring-[var(--line-default)]"
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="lg" onClick={() => void save()} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : null} Save branding
          </Button>
          <Button size="lg" variant="outline" onClick={() => void reset()} disabled={busy}>
            Reset to Odr
          </Button>
        </div>
      </div>
    </Section>

    <FloorLayoutSection />
    </div>
  );
};

/** How the Tables screen presents itself — a per-device choice. */
const FloorLayoutSection = () => {
  const [layout, setLayout] = useState<FloorLayout>(getFloorLayout);
  return (
    <Section
      title="Tables view"
      hint="How the Tables screen shows sales, stats and the table grid — saved on this device."
    >
      <span className="relative block w-full sm:max-w-[320px]">
        <select
          value={layout}
          onChange={(e) => {
            const l = e.target.value as FloorLayout;
            setLayout(l);
            setFloorLayout(l);
          }}
          className="appearance-none h-11 w-full pl-3 pr-9 text-[14px] rounded-[var(--radius-2)]
                     bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]
                     focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          {FLOOR_LAYOUTS.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
      </span>
      <p className="mt-1.5 text-[12px] text-[var(--fg-tertiary)]">
        {FLOOR_LAYOUTS.find((l) => l.key === layout)?.hint}
      </p>
    </Section>
  );
};

