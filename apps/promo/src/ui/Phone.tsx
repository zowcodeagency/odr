import type { CSSProperties, ReactNode } from "react";
import { C, SANS } from "../theme.ts";

export const SCREEN_W = 390;
export const SCREEN_H = 820;

/**
 * A phone frame with a 390×820 screen. `scale` fits it into the layout;
 * everything inside is laid out in screen pixels, like the real app.
 */
export const Phone = ({ children, scale = 1, style }: { children: ReactNode; scale?: number; style?: CSSProperties }) => (
  <div style={{ width: (SCREEN_W + 24) * scale, height: (SCREEN_H + 24) * scale, ...style }}>
    <div
      style={{
        width: SCREEN_W + 24, height: SCREEN_H + 24, transform: `scale(${scale})`, transformOrigin: "top left",
        background: C.ink, borderRadius: 54, padding: 12,
        boxShadow: "0 40px 80px -30px rgba(27,24,21,0.45), 0 0 0 1px rgba(255,255,255,0.08) inset",
      }}
    >
      <div style={{ width: SCREEN_W, height: SCREEN_H, borderRadius: 44, overflow: "hidden", background: C.canvas, position: "relative", fontFamily: SANS, color: C.fg }}>
        {children}
        {/* notch */}
        <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 118, height: 32, borderRadius: 20, background: C.ink }} />
      </div>
    </div>
  </div>
);

/** App top bar as the phone shows it: title left, outlet pill right. */
export const TopBar = ({ title, outlet = "Cafe Sagar" }: { title: string; outlet?: string }) => (
  <div style={{ paddingTop: 56, paddingLeft: 20, paddingRight: 20, paddingBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>{title}</span>
    <span style={{ fontSize: 12, fontWeight: 500, padding: "6px 10px", borderRadius: 999, background: C.surface2, color: C.fg2, border: `1px solid ${C.line}` }}>{outlet}</span>
  </div>
);

export const Card = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, ...style }}>{children}</div>
);

export const GreenButton = ({ children, pressed = 0, style }: { children: ReactNode; pressed?: number; style?: CSSProperties }) => (
  <div
    style={{
      height: 52, borderRadius: 12, background: pressed ? "#166E49" : C.accent, color: "white",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600,
      transform: `scale(${1 - pressed * 0.04})`, ...style,
    }}
  >
    {children}
  </div>
);
