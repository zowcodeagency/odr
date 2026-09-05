import { interpolate, useCurrentFrame } from "remotion";
import { C, MONO } from "../theme.ts";
import { Scene } from "../ui/Layout.tsx";
import { Card, GreenButton, TopBar } from "../ui/Phone.tsx";
import { Qr } from "../ui/Qr.tsx";
import { Logo } from "../ui/Logo.tsx";
import { at, rise, useEnter } from "../ui/motion.ts";

const CHANNELS = ["Dine-in", "Parcel", "Zomato", "Swiggy", "QR"];

const QrCard = () => {
  const p = useEnter(30, 16);
  return (
    <div style={{ ...rise(p, 30), width: 300, background: "white", borderRadius: 18, padding: 26, boxShadow: "0 30px 60px -30px rgba(27,24,21,0.4), 0 0 0 1px rgba(0,0,0,0.06)", textAlign: "center", color: C.ink }}>
      <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: C.fg2 }}>Scan to order</div>
      <div style={{ margin: "16px auto 0", width: 200 }}><Qr size={200} seed={4} /></div>
      <div style={{ marginTop: 16, fontSize: 40, fontWeight: 700, fontFamily: MONO, letterSpacing: "-0.03em" }}>T-4</div>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}><Logo size={22} wordmark /></div>
    </div>
  );
};

export const Channels = ({ durationInFrames }: { durationInFrames: number }) => {
  const frame = useCurrentFrame();
  // The highlight walks along the channel pills, then rests on Parcel.
  const f = (x: number) => at(durationInFrames, x);
  const idx = Math.min(4, Math.floor(interpolate(frame, [f(0.08), f(0.4)], [0, 5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const active = frame > f(0.46) ? 1 : idx;
  const btn = interpolate(frame, [f(0.52), f(0.55), f(0.6)], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tiles = useEnter(f(0.62), 16);
  return (
    <Scene
      durationInFrames={durationInFrames}
      kicker="Beyond the tables"
      title="Parcels, Zomato, Swiggy. Same kitchen, same bill."
      points={["One tap to start an off-table order", "Diners scan the table QR and order themselves", "Every channel shows up in your sales"]}
      screen={
        <>
          <TopBar title="New order" />
          <div style={{ padding: "0 16px", fontSize: 12, color: C.fg3 }}>Where is this order from?</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 16 }}>
            {CHANNELS.map((c, i) => (
              <div key={c} style={{
                padding: "10px 16px", borderRadius: 999, fontSize: 14, fontWeight: 500,
                background: i === active ? C.accent : C.surface, color: i === active ? "white" : C.fg2,
                border: `1px solid ${i === active ? C.accent : C.line}`,
              }}>{c}</div>
            ))}
          </div>
          <div style={{ padding: "0 16px" }}>
            <Card style={{ padding: "12px 14px", fontSize: 14, color: C.fg3 }}>Customer name (optional) <span style={{ color: C.fg }}>Ravi</span></Card>
            <GreenButton pressed={btn} style={{ marginTop: 12 }}>Start order</GreenButton>
          </div>
          <div style={{ padding: "22px 16px 0", ...rise(tiles, 24) }}>
            <div style={{ fontSize: 12, color: C.fg3, marginBottom: 8 }}>Off the floor · 3</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["Parcel", "Ravi", "₹500", C.open], ["Zomato", "#4821", "₹1,240", C.aggregator], ["Swiggy", "#S-77", "₹680", C.aggregator]].map(([ch, who, amt, tone]) => (
                <Card key={who} style={{ padding: 12, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: tone }} />
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: tone, fontWeight: 600 }}>{ch}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{who}</div>
                  <div style={{ fontFamily: MONO, fontSize: 13, marginTop: 6 }}>{amt}</div>
                </Card>
              ))}
            </div>
          </div>
        </>
      }
      aside={<QrCard />}
    />
  );
};
