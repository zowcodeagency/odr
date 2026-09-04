/*
 * Tenant branding — the owner's colors, font, logo and theme, applied as CSS
 * variable overrides on <html>. The token sheet stays untouched; clearing the
 * overrides restores the stock Odr look.
 *
 * Cached in localStorage so a themed device paints branded on first frame,
 * then refreshed from the API once per boot.
 */

export type BrandStyle = "classic" | "gradient" | "soft" | "sharp" | "glass";

export interface Branding {
  primary: string;
  secondary: string;
  /** Optional heading accent. */
  tertiary?: string | null;
  /** Text on primary buttons. null = auto black/white from the primary. */
  onPrimary?: string | null;
  font: string;
  theme: "light" | "dark" | "auto";
  /** Visual variant — radii, shadows, gradients. */
  style?: BrandStyle;
  /** Small data-URL image, shown in the topbar. */
  logo?: string | null;
}

export const STYLES: { key: BrandStyle; label: string; hint: string }[] = [
  { key: "classic", label: "Classic", hint: "The stock Odr look" },
  { key: "gradient", label: "Gradient", hint: "Buttons and canvas get a color sweep" },
  { key: "soft", label: "Soft", hint: "Round corners, gentle shadows" },
  { key: "sharp", label: "Sharp", hint: "Square, flat, no shadows" },
  { key: "glass", label: "Glass", hint: "Frosted cards over a color wash" },
];

/** First entry is the stock font — picking it means "no override". */
export const FONTS = [
  "IBM Plex Sans",
  "Inter",
  "Manrope",
  "Poppins",
  "Nunito",
  "DM Sans",
  "Work Sans",
  "Outfit",
  "Sora",
  "Space Grotesk",
  "Karla",
  "Rubik",
  "Lora",
  "Playfair Display",
];

export const DEFAULT_BRANDING: Branding = {
  primary: "#2f9e6e",
  secondary: "#f2efe6",
  tertiary: null,
  onPrimary: null,
  font: FONTS[0]!,
  theme: "auto",
  style: "classic",
  logo: null,
};

/** Black or white, whichever reads on the given #rrggbb — YIQ rule of thumb. */
export const autoOnColor = (hexColor: string): string => {
  const n = parseInt(hexColor.slice(1), 16);
  const yiq = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return yiq > 155 ? "#1c1917" : "#ffffff";
};

/*
 * Floor layout — how the Tables page presents itself. A per-device choice
 * (a floor phone wants Compact, the counter iPad can go Vivid), so it lives
 * in localStorage, not in the tenant branding blob.
 */
export type FloorLayout = "classic" | "compact" | "vivid" | "glassy" | "premium";

export const FLOOR_LAYOUTS: { key: FloorLayout; label: string; hint: string }[] = [
  { key: "classic", label: "Classic", hint: "Stat cards and a roomy table grid" },
  { key: "compact", label: "Compact", hint: "Dense grid, one-line stats — big floors" },
  { key: "vivid", label: "Vivid", hint: "Colorful stat cards and sales gradient" },
  { key: "glassy", label: "Glassy", hint: "Frosted cards over a color wash, like iOS" },
  { key: "premium", label: "Premium", hint: "A rich gradient sales hero in your brand color" },
];

const LAYOUT_KEY = "odr.floorLayout";

export const getFloorLayout = (): FloorLayout => {
  const v = localStorage.getItem(LAYOUT_KEY);
  return FLOOR_LAYOUTS.some((l) => l.key === v) ? (v as FloorLayout) : "classic";
};

export const setFloorLayout = (l: FloorLayout): void => {
  localStorage.setItem(LAYOUT_KEY, l);
};

const KEY = "odr.branding";

export const getStoredBranding = (): Branding | null => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Branding) : null;
  } catch {
    return null;
  }
};

export const storeBranding = (b: Branding | null): void => {
  if (b) localStorage.setItem(KEY, JSON.stringify(b));
  else localStorage.removeItem(KEY);
};

/* Every var applyBranding may touch — cleared before each apply. */
const VARS = [
  "--accent",
  "--accent-hover",
  "--accent-pressed",
  "--fg-on-accent",
  "--bg-canvas",
  "--bg-surface-2",
  "--brand-heading",
  "--font-body",
] as const;

const loadFont = (family: string): string | null => {
  const id = "odr-brand-font";
  document.getElementById(id)?.remove();
  if (family === FONTS[0]) return null; // stock font is already in index.html
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;500;600&display=swap`;
  document.head.appendChild(link);
  return link.href;
};

/**
 * The finished paint — resolved CSS vars, theme, style, font URL — so the
 * inline script in index.html can replay it before first frame. This module
 * runs after that frame, so applying the stored Branding here is too late to
 * stop the stock-colour flash.
 */
export const PAINT_KEY = "odr.brandingPaint";
const snapshotPaint = (fontHref: string | null): void => {
  const root = document.documentElement;
  try {
    localStorage.setItem(
      PAINT_KEY,
      JSON.stringify({ css: root.style.cssText, theme: root.dataset["theme"] ?? "", style: root.dataset["style"] ?? "", font: fontHref ?? "" }),
    );
  } catch { /* private mode */ }
};

/** null = back to stock Odr. */
export const applyBranding = (b: Branding | null): void => {
  const root = document.documentElement;
  for (const v of VARS) root.style.removeProperty(v);

  if (!b) {
    delete root.dataset["theme"];
    delete root.dataset["style"];
    loadFont(FONTS[0]!);
    try { localStorage.removeItem(PAINT_KEY); } catch { /* private mode */ }
    return;
  }

  // Primary drives the accent; hover/pressed shade toward the theme's ink so
  // one picked color works in light and dark. --accent-soft and --ring in the
  // token sheet derive from --accent, so they follow for free.
  root.style.setProperty("--accent", b.primary);
  root.style.setProperty("--accent-hover", `color-mix(in oklab, ${b.primary} 86%, light-dark(black, white))`);
  root.style.setProperty("--accent-pressed", `color-mix(in oklab, ${b.primary} 75%, light-dark(black, white))`);
  // A yellow primary with white text is unreadable — auto-pick unless the
  // owner overrode it.
  root.style.setProperty("--fg-on-accent", b.onPrimary ?? autoOnColor(b.primary));

  // Secondary washes the app background — a tint, never a flood, so text
  // contrast survives whatever the owner picks.
  root.style.setProperty("--bg-canvas", `color-mix(in oklab, ${b.secondary} 14%, light-dark(white, oklch(15% 0.008 60)))`);
  root.style.setProperty("--bg-surface-2", `color-mix(in oklab, ${b.secondary} 20%, light-dark(white, oklch(21.5% 0.01 60)))`);

  if (b.tertiary) root.style.setProperty("--brand-heading", b.tertiary);

  if (b.font && b.font !== FONTS[0]) {
    root.style.setProperty("--font-body", `"${b.font}", ui-sans-serif, system-ui, sans-serif`);
  }
  const fontHref = loadFont(b.font);

  if (b.theme === "auto") delete root.dataset["theme"];
  else root.dataset["theme"] = b.theme;

  // Style variants live in index.css keyed off this attribute.
  if (b.style && b.style !== "classic") root.dataset["style"] = b.style;
  else delete root.dataset["style"];

  snapshotPaint(fontHref);
};

/** File → small data-URL (fits the API's 200KB cap): downscale to ≤128px tall PNG. */
export const fileToLogo = async (file: File): Promise<string> => {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 128 / bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
};
