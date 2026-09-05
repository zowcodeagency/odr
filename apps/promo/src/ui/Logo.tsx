import { C, SANS } from "../theme.ts";

/** The Odr mark: open ring with a detached dot — same geometry as the app's shell/logo.tsx. */
export const Logo = ({ size = 28, wordmark = false, color = C.fg }: { size?: number; wordmark?: boolean; color?: string }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.28 }}>
    <svg viewBox="0 0 256 256" width={size} height={size} style={{ overflow: "visible", flexShrink: 0 }}>
      <circle cx="122" cy="128" r="72" fill="none" stroke={C.green} strokeWidth="30" strokeLinecap="round"
        strokeDasharray="402 50" transform="rotate(7 122 128)" />
      <circle cx="220" cy="128" r="15" fill={C.green} />
    </svg>
    {wordmark ? (
      <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: Math.round(size * 0.62), letterSpacing: "-0.055em", lineHeight: 1, color }}>
        odr
      </span>
    ) : null}
  </span>
);
