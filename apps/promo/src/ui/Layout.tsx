import type { ReactNode } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { C, SANS } from "../theme.ts";
import { Phone, SCREEN_H, SCREEN_W } from "./Phone.tsx";
import { useEnter, useSceneFade } from "./motion.ts";

/**
 * Every product scene is a phone plus a caption. Landscape puts the phone on
 * the left and the words on the right; portrait stacks them. The scenes only
 * decide what is on the screen and what the caption says.
 */
export const Scene = ({
  screen, kicker, title, points = [], durationInFrames, aside,
}: {
  screen: ReactNode;
  kicker: string;
  title: string;
  points?: string[];
  durationInFrames: number;
  /** Optional second visual beside the phone (a receipt, a QR card). */
  aside?: ReactNode;
}) => {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  const fade = useSceneFade(durationInFrames);
  const phoneIn = useEnter(0, 20);
  const titleIn = useEnter(6);

  const phoneScale = portrait ? (height * 0.56) / (SCREEN_H + 24) : (height * 0.82) / (SCREEN_H + 24);

  return (
    <AbsoluteFill style={{ background: C.canvas, opacity: fade, fontFamily: SANS, color: C.fg }}>
      {/* soft green glow behind the phone */}
      <div style={{
        position: "absolute", width: 900, height: 900, borderRadius: "50%", filter: "blur(120px)", opacity: 0.35,
        background: `radial-gradient(circle, ${C.green}, transparent 70%)`,
        left: portrait ? width / 2 - 450 : width * 0.28 - 450, top: portrait ? height * 0.3 - 450 : height / 2 - 450,
      }} />

      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: portrait ? "column" : "row",
        alignItems: "center", justifyContent: portrait ? "flex-start" : "center", gap: portrait ? 36 : 96,
        padding: portrait ? "100px 72px 120px" : "0 120px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 40, opacity: phoneIn, transform: `translateY(${(1 - phoneIn) * 40}px)` }}>
          <Phone scale={phoneScale}>{screen}</Phone>
          {aside ? <div style={{ width: portrait ? 0 : "auto", display: portrait ? "none" : "block" }}>{aside}</div> : null}
        </div>

        <div style={{
          flex: portrait ? "none" : 1, maxWidth: portrait ? "100%" : 720, textAlign: portrait ? "center" : "left",
          opacity: titleIn, transform: `translateY(${(1 - titleIn) * 24}px)`,
        }}>
          <div style={{ fontSize: portrait ? 26 : 22, fontWeight: 600, color: C.accent, letterSpacing: "0.08em", textTransform: "uppercase" }}>{kicker}</div>
          <h1 style={{ margin: "14px 0 0", fontSize: portrait ? 70 : 64, lineHeight: 1.06, fontWeight: 700, letterSpacing: "-0.03em" }}>{title}</h1>
          {points.length ? (
            <ul style={{ listStyle: "none", padding: 0, margin: "28px 0 0", display: "flex", flexDirection: "column", gap: 12, alignItems: portrait ? "center" : "flex-start" }}>
              {points.map((p, i) => <Point key={p} text={p} delay={14 + i * 8} />)}
            </ul>
          ) : null}
        </div>
      </div>

      <div style={{ position: "absolute", left: portrait ? "50%" : 120, transform: portrait ? "translateX(-50%)" : undefined, bottom: portrait ? 52 : 48, opacity: 0.85 }}>
        <Brand />
      </div>
    </AbsoluteFill>
  );
};

const Point = ({ text, delay }: { text: string; delay: number }) => {
  const p = useEnter(delay);
  return (
    <li style={{ display: "flex", alignItems: "flex-start", gap: 14, fontSize: 28, lineHeight: 1.3, color: C.fg2, opacity: p, transform: `translateX(${(1 - p) * 20}px)` }}>
      <span style={{ width: 10, height: 10, borderRadius: 5, background: C.green, flexShrink: 0, marginTop: 13 }} />
      {text}
    </li>
  );
};

import { Logo } from "./Logo.tsx";
const Brand = () => <Logo size={34} wordmark />;
