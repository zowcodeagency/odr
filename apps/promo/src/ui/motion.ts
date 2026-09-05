import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/** 0→1 spring that starts at `delay` frames into the current sequence. */
export const useEnter = (delay = 0, damping = 18) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.9, stiffness: 120 }, durationInFrames: 30 });
};

/** Rise-and-fade style for a staggered list item. */
export const rise = (p: number, px = 24) => ({
  opacity: p,
  transform: `translateY(${interpolate(p, [0, 1], [px, 0])}px)`,
});

/** A count-up: integer-ish progress towards `to` between two frames. */
export const useCount = (to: number, from: number, until: number) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [from, until], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return Math.round(to * (1 - Math.pow(1 - p, 3)));
};

/** Fade in at the start and out at the end of a scene. */
export const useSceneFade = (durationInFrames: number, edge = 10) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [0, edge, durationInFrames - edge, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

/** Frame at a fraction of the scene — beats stay in place when the voice retimes the cut. */
export const at = (durationInFrames: number, fraction: number) => Math.round(durationInFrames * fraction);

export const inr = (minor: number) =>
  "₹" + (minor / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
