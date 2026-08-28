/* Shared bits: the five hand-written icons, the veg mark, the qty stepper. */

type IconProps = { className?: string };

const svg = (d: string) =>
  function Icon({ className = "size-5" }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
      >
        <path d={d} />
      </svg>
    );
  };

export const PlusIcon = svg("M12 5v14M5 12h14");
export const MinusIcon = svg("M5 12h14");
export const CloseIcon = svg("M6 6l12 12M18 6L6 18");
export const CheckIcon = svg("M4 12.5l5 5L20 6.5");
export const ChevronIcon = svg("M9 5l7 7-7 7");

/**
 * The standard Indian veg/non-veg mark: a bordered square with a filled dot.
 * Anything that isn't explicitly veg is shown as non-veg.
 */
export function VegBadge({ isVeg }: { isVeg?: boolean | null }) {
  const c = isVeg ? "text-veg" : "text-nonveg";
  return (
    <span
      className={`inline-flex size-[15px] shrink-0 items-center justify-center rounded-[3px] border-[1.5px] border-current ${c}`}
      title={isVeg ? "Vegetarian" : "Non-vegetarian"}
    >
      <span className="sr-only">{isVeg ? "Vegetarian" : "Non-vegetarian"}</span>
      <span className="block size-[7px] rounded-full bg-current" />
    </span>
  );
}

/** 44px-tall −/qty/+ control. Qty is clamped 1–20 by the caller's onChange. */
export function Stepper({
  qty,
  onChange,
  label,
}: {
  qty: number;
  onChange: (next: number) => void;
  label: string;
}) {
  const btn =
    "flex size-11 items-center justify-center text-accent transition-colors active:bg-accent-soft disabled:opacity-35";
  return (
    <div className="flex items-center rounded-xl border border-accent/40 bg-raised">
      <button type="button" className={btn} onClick={() => onChange(qty - 1)} aria-label={`Remove one ${label}`}>
        <MinusIcon className="size-4" />
      </button>
      <span className="w-6 text-center text-[15px] font-bold tabular-nums" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(qty + 1)}
        disabled={qty >= 20}
        aria-label={`Add one ${label}`}
      >
        <PlusIcon className="size-4" />
      </button>
    </div>
  );
}
