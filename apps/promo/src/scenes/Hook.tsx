import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, SANS } from "../theme.ts";
import { useEnter, useSceneFade } from "../ui/motion.ts";

export const Hook = ({ durationInFrames }: { durationInFrames: number }) => {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const portrait = height > width;
  const fade = useSceneFade(durationInFrames, 12);
  const draw = interpolate(frame, [0, 40], [0, 1], { extrapolateRight: "clamp" });
  const dot = useEnter(34, 12);
  const word = useEnter(44);
  const line = useEnter(60);
  const size = portrait ? 260 : 220;
  return (
    <AbsoluteFill style={{ background: C.canvas, opacity: fade, alignItems: "center", justifyContent: "center", fontFamily: SANS, color: C.fg }}>
      <div style={{ display: "flex", flexDirection: portrait ? "column" : "row", alignItems: "center", gap: portrait ? 24 : 40 }}>
        <svg viewBox="0 0 256 256" width={size} height={size} style={{ overflow: "visible" }}>
          <circle cx="122" cy="128" r="72" fill="none" stroke={C.green} strokeWidth="30" strokeLinecap="round"
            strokeDasharray={`${402 * draw} 1000`} transform="rotate(7 122 128)" />
          <circle cx="220" cy="128" r={15 * dot} fill={C.green} />
        </svg>
        <div style={{ fontSize: portrait ? 200 : 190, fontWeight: 700, letterSpacing: "-0.06em", lineHeight: 1, opacity: word, transform: `translateY(${(1 - word) * 30}px)` }}>odr</div>
      </div>
      <p style={{ margin: "44px 0 0", fontSize: portrait ? 44 : 42, color: C.fg2, textAlign: "center", maxWidth: 1100, lineHeight: 1.25, opacity: line, transform: `translateY(${(1 - line) * 20}px)` }}>
        The restaurant system that runs on the phone already in your pocket — and in a browser tab on the counter.
      </p>
    </AbsoluteFill>
  );
};
