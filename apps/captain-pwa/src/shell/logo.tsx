import { cn } from "@odr/ui";
import { getStoredBranding } from "../lib/branding.ts";

/** Brand green. Fixed — it reads on both the light and the dark canvas. */
const GREEN = "#40D39A";

/** The restaurant's own logo when the owner set one, the Odr mark otherwise. */
export const BrandMark = ({ size = 28 }: { size?: number }) => {
  const logo = getStoredBranding()?.logo;
  return logo ? (
    <img
      src={logo}
      alt=""
      style={{ height: size }}
      className="w-auto max-w-[110px] object-contain"
    />
  ) : (
    <Logo size={size} />
  );
};

/**
 * The Odr mark: an open ring with a detached dot (dev/designs/logo).
 * Inline SVG rather than an <img> — two circles, no network, no flash.
 */
export const Logo = ({
  size = 28,
  wordmark = false,
  className,
}: {
  size?: number;
  wordmark?: boolean;
  className?: string;
}) => (
  <span className={cn("inline-flex items-center gap-2", className)}>
    <svg
      viewBox="0 0 256 256"
      width={size}
      height={size}
      aria-hidden
      className="shrink-0 overflow-visible"
    >
      <circle
        cx="122"
        cy="128"
        r="72"
        fill="none"
        stroke={GREEN}
        strokeWidth="30"
        strokeLinecap="round"
        strokeDasharray="402 50"
        transform="rotate(7 122 128)"
      />
      <circle cx="220" cy="128" r="15" fill={GREEN} />
    </svg>
    {/* The wordmark inherits colour — QR cards are white paper, the app is not. */}
    {wordmark ? (
      <span
        style={{ fontSize: Math.round(size * 0.62) }}
        className="font-bold tracking-[-0.055em] leading-none"
      >
        odr
      </span>
    ) : null}
  </span>
);
