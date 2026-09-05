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

/*
 * The cut follows the voice. Paragraph start times were measured from
 * public/voiceover.mp3 with whisper word timestamps (out/asr). Re-measure and
 * update VOICE_STARTS if the voiceover is re-recorded.
 */
export const VOICE_LEAD = 0.8; // silence before the first word
const VOICE_STARTS = [0, 4.9, 12.54, 18.72, 29.06, 39.08, 48.62, 56.56];
const VOICE_END = 65.6;
const CUT_AHEAD = 0.3; // the picture changes a beat before the line
const HOLD = 3.6; // the close card stays after the last word
const IDS = ["hook", "floor", "kitchen", "bill", "channels", "sales", "outlets", "close"] as const;
export type SceneId = (typeof IDS)[number];
export const SCENES = IDS.map((id, i) => ({
  id,
  from: i === 0 ? 0 : VOICE_LEAD + VOICE_STARTS[i]! - CUT_AHEAD,
  to: i === IDS.length - 1 ? VOICE_LEAD + VOICE_END + HOLD : VOICE_LEAD + VOICE_STARTS[i + 1]! - CUT_AHEAD,
}));
export const TOTAL_FRAMES = sec(SCENES[SCENES.length - 1]!.to);
