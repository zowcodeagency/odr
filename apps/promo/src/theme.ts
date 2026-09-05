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
 * The cut follows the voice. Paragraph start times were measured from the
 * voice files with whisper word timestamps (out/asr). Re-measure and update
 * `starts` if a take is re-recorded.
 */
export type Voice = "indian" | "system";
export const VOICES: Record<Voice, { file: string; starts: number[]; end: number }> = {
  indian: { file: "voice-indian.mp3", starts: [0, 4.9, 12.54, 18.72, 29.06, 39.08, 48.62, 56.56], end: 65.6 },
  system: { file: "voice-system.mp3", starts: [0, 5.56, 14.44, 19.98, 29.54, 37.38, 46.22, 52.86], end: 61.94 },
};
export const VOICE_LEAD = 0.8; // silence before the first word
const CUT_AHEAD = 0.3; // the picture changes a beat before the line
const HOLD = 3.6; // the close card stays after the last word
const IDS = ["hook", "floor", "kitchen", "bill", "channels", "sales", "outlets", "close"] as const;
export type SceneId = (typeof IDS)[number];
export const scenesFor = (voice: Voice) => {
  const { starts, end } = VOICES[voice];
  return IDS.map((id, i) => ({
    id,
    from: i === 0 ? 0 : VOICE_LEAD + starts[i]! - CUT_AHEAD,
    to: i === IDS.length - 1 ? VOICE_LEAD + end + HOLD : VOICE_LEAD + starts[i + 1]! - CUT_AHEAD,
  }));
};
export const totalFrames = (voice: Voice) => sec(scenesFor(voice)[IDS.length - 1]!.to);
