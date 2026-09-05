import { interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { C, MONO } from "../theme.ts";
import { Scene } from "../ui/Layout.tsx";
import { Card, GreenButton } from "../ui/Phone.tsx";
import { at, rise, useEnter } from "../ui/motion.ts";

const OUTLETS: [string, string, string][] = [["Cafe Sagar", "Balmatta Road", "₹48,632"], ["Sagar Express", "Kadri", "₹31,910"], ["Sagar Kitchen", "Surathkal", "₹22,405"]];
const BRAND2 = "#B5432B"; // the owner's own colour after the switch

const OutletRow = ({ name, where, sales, i, on, accent }: { name: string; where: string; sales: string; i: number; on: boolean; accent: string }) => {
  const p = useEnter(10 + i * 6);
  return (
    <Card style={{ ...rise(p, 14), padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderColor: on ? accent : C.line, boxShadow: on ? `0 0 0 2px ${accent}` : undefined }}>
      <span style={{ width: 36, height: 36, borderRadius: 10, background: on ? accent : C.surface2, color: on ? "white" : C.fg2, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{name[0]}</span>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{name}</span>
        <span style={{ display: "block", fontSize: 12, color: C.fg3 }}>{where} · today</span>
      </span>
      <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600 }}>{sales}</span>
    </Card>
  );
};

export const Outlets = ({ durationInFrames }: { durationInFrames: number }) => {
  const frame = useCurrentFrame();
  const f = (x: number) => at(durationInFrames, x);
  // "Switch in a tap" → the selection moves; "Your logo, your colours" → the app rebrands.
  const sel = frame < f(0.25) ? 0 : frame < f(0.42) ? 1 : 2;
  const rebrand = interpolate(frame, [f(0.6), f(0.72)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const accent = interpolateColors(rebrand, [0, 1], [C.accent, BRAND2]);
  const logoIn = useEnter(f(0.64), 14);
  return (
    <Scene
      durationInFrames={durationInFrames}
      kicker="Grow"
      title="More than one outlet? Switch in a tap. Your brand, everywhere."
      points={["Own tables, printer, GSTIN and invoice numbers per outlet", "Owners see every outlet's sales on one screen", "Your logo and colours on the app and on every bill"]}
      screen={
        <>
          <div style={{ padding: "56px 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {rebrand > 0 ? (
              <span style={{ opacity: logoIn, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: BRAND2, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 15 }}>S</span>
                <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>Sagar Foods</span>
              </span>
            ) : (
              <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Tables</span>
            )}
            <span style={{ fontSize: 12, fontWeight: 500, padding: "6px 10px", borderRadius: 999, background: C.surface2, color: C.fg2, border: `1px solid ${C.line}` }}>{OUTLETS[sel]![0]} ▾</span>
          </div>
          <div style={{ padding: "6px 16px 0", fontSize: 12, color: C.fg3 }}>Switch outlet</div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {OUTLETS.map(([name, where, sales], i) => (
              <OutletRow key={name} name={name} where={where} sales={sales} i={i} on={i === sel} accent={accent} />
            ))}
          </div>
          <div style={{ margin: "6px 16px 0", padding: "14px 16px", borderRadius: 12, background: C.surface, border: `1px solid ${C.line}` }}>
            <div style={{ fontSize: 12, color: C.fg3 }}>All outlets · today</div>
            <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 600, marginTop: 4, letterSpacing: "-0.02em" }}>₹1,02,947</div>
          </div>
          <div style={{ position: "absolute", left: 16, right: 16, bottom: 28 }}>
            <GreenButton style={{ background: accent }}>Settle &amp; bill</GreenButton>
          </div>
        </>
      }
    />
  );
};
