import { AbsoluteFill, useVideoConfig } from "remotion";
import { C, SANS } from "../theme.ts";
import { Logo } from "../ui/Logo.tsx";
import { useEnter, useSceneFade } from "../ui/motion.ts";

export const Close = ({ durationInFrames, tagline, contact, email }: { durationInFrames: number; tagline: string; contact: string; email: string }) => {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  const fade = useSceneFade(durationInFrames, 14);
  const logo = useEnter(0, 16);
  const line = useEnter(18);
  const cta = useEnter(34);
  const mail = useEnter(46);
  return (
    <AbsoluteFill style={{ background: C.ink, opacity: fade, alignItems: "center", justifyContent: "center", fontFamily: SANS, color: "white", textAlign: "center", padding: "0 80px" }}>
      <div style={{ opacity: logo, transform: `scale(${0.9 + logo * 0.1})` }}>
        <Logo size={portrait ? 200 : 170} wordmark color="white" />
      </div>
      <p style={{ margin: "40px 0 0", fontSize: portrait ? 46 : 44, lineHeight: 1.25, maxWidth: 1100, color: "rgba(255,255,255,0.86)", opacity: line, transform: `translateY(${(1 - line) * 20}px)` }}>{tagline}</p>
      <div style={{ marginTop: 44, padding: "18px 36px", borderRadius: 999, background: C.green, color: C.ink, fontSize: portrait ? 34 : 30, fontWeight: 600, opacity: cta, transform: `translateY(${(1 - cta) * 16}px)` }}>{contact}</div>
      <p style={{ margin: "26px 0 0", fontSize: portrait ? 32 : 28, color: "rgba(255,255,255,0.7)", opacity: mail, transform: `translateY(${(1 - mail) * 12}px)` }}>
        Talk to us · {email}
      </p>
      <p style={{ margin: "18px 0 0", fontSize: portrait ? 24 : 22, color: "rgba(255,255,255,0.45)", opacity: mail }}>
        Nothing to install — opens on any phone, tablet or computer browser
      </p>
    </AbsoluteFill>
  );
};
