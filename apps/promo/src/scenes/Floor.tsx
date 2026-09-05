import { interpolate, useCurrentFrame } from "remotion";
import { C, MONO } from "../theme.ts";
import { Scene } from "../ui/Layout.tsx";
import { Card, TopBar } from "../ui/Phone.tsx";
import { rise, useEnter } from "../ui/motion.ts";

type Status = "free" | "open" | "firing" | "settled";
const TILES: [string, Status, string][] = [
  ["T-1", "open", "₹640"], ["T-2", "free", ""], ["T-3", "firing", "₹1,120"], ["T-4", "free", ""],
  ["T-5", "settled", "₹380"], ["T-6", "open", "₹210"], ["T-7", "free", ""], ["T-8", "firing", "₹2,340"],
  ["T-9", "free", ""], ["T-10", "open", "₹960"], ["T-11", "free", ""], ["T-12", "free", ""],
];
const TONE: Record<Status, string> = { free: C.line, open: C.open, firing: C.firing, settled: C.settled };
const LABEL: Record<Status, string> = { free: "Free", open: "Open", firing: "In kitchen", settled: "Paid" };

const Tile = ({ label, status, amount, i, tapped }: { label: string; status: Status; amount: string; i: number; tapped: number }) => {
  const p = useEnter(8 + i * 3);
  return (
    <Card style={{ ...rise(p, 16), height: 96, padding: 12, position: "relative", overflow: "hidden", boxShadow: tapped ? `0 0 0 ${3 * tapped}px ${C.accent}` : undefined }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: TONE[status] }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 600 }}>
        <span>{label}</span>
        {status === "firing" ? <span style={{ fontSize: 11, color: C.firing }}>●</span> : null}
      </div>
      <div style={{ fontSize: 12, color: C.fg3, marginTop: 4 }}>{LABEL[status]}</div>
      {amount ? <div style={{ fontFamily: MONO, fontSize: 14, marginTop: 10 }}>{amount}</div> : null}
    </Card>
  );
};

const Stat = ({ k, v, i }: { k: string; v: string; i: number }) => {
  const p = useEnter(4 + i * 3);
  return (
    <div style={{ ...rise(p, 10), flex: 1, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontSize: 10, color: C.fg3 }}>{k}</div>
      <div style={{ fontSize: 15, fontWeight: 600, fontFamily: MONO, marginTop: 2 }}>{v}</div>
    </div>
  );
};

export const Floor = ({ durationInFrames }: { durationInFrames: number }) => {
  const frame = useCurrentFrame();
  const tap = interpolate(frame, [110, 122, 150], [0, 1, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Scene
      durationInFrames={durationInFrames}
      kicker="The floor"
      title="Every table, live. One tap opens an order."
      points={["See what is free, cooking or paid", "Add tables in seconds: T-1 to T-12", "Works on any phone or tablet"]}
      screen={
        <>
          <TopBar title="Tables" />
          <div style={{ display: "flex", gap: 8, padding: "4px 16px 12px" }}>
            {[["Open", "5"], ["In kitchen", "2"], ["Paid today", "₹12,480"]].map(([k, v], i) => <Stat key={k} k={k!} v={v!} i={i} />)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, padding: "0 16px" }}>
            {TILES.map(([l, s, a], i) => <Tile key={l} label={l} status={s} amount={a} i={i} tapped={l === "T-4" ? tap : 0} />)}
          </div>
        </>
      }
    />
  );
};
