/* Odr's light theme, flattened to hex — Remotion renders in Chrome, no light-dark() needed. */
import { loadFont as loadSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";

export const SANS = loadSans("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] }).fontFamily;
export const MONO = loadMono("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily;

export const C = {
  canvas: "#F6F3EC",
  surface: "#FFFEFB",
  surface2: "#F0ECE4",
  surface3: "#E7E2D8",
  fg: "#2A2622",
  fg2: "#57514A",
  fg3: "#6C665E",
  muted: "#8B837A",
  line: "#E1DBD0",
  lineSubtle: "#ECE7DE",
  green: "#40D39A",
  accent: "#1E8A5D",
  accentSoft: "rgba(30,138,93,0.13)",
  open: "#6F675C",
  firing: "#C97C18",
  fired: "#3A5BD9",
  settled: "#2C9C5A",
  voided: "#C64429",
  aggregator: "#2E7EB7",
  ink: "#1B1815",
  paper: "#FBFAF7",
};

export const FPS = 30;
export const sec = (s: number) => Math.round(s * FPS);

/* The cut. Durations in seconds; the voiceover script in SCRIPT.md follows the same numbers. */
export const SCENES = [
  { id: "hook", seconds: 6 },
  { id: "floor", seconds: 9 },
  { id: "kitchen", seconds: 11 },
  { id: "bill", seconds: 12 },
  { id: "channels", seconds: 10 },
  { id: "sales", seconds: 14 },
  { id: "outlets", seconds: 10 },
  { id: "close", seconds: 8 },
] as const;
export type SceneId = (typeof SCENES)[number]["id"];
export const TOTAL_FRAMES = SCENES.reduce((a, s) => a + sec(s.seconds), 0);
export const startOf = (id: SceneId) => {
  let f = 0;
  for (const s of SCENES) {
    if (s.id === id) return f;
    f += sec(s.seconds);
  }
  return f;
};
