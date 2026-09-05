import { interpolate, useCurrentFrame } from "remotion";
import { C, MONO } from "../theme.ts";
import { Scene } from "../ui/Layout.tsx";
import { Card, TopBar } from "../ui/Phone.tsx";
import { at, inr, rise, useCount, useEnter } from "../ui/motion.ts";

const PILLS = ["Today", "This week", "This month", "Pick dates"];
// Today → This month, then the numbers grow to the month's figures.
const TARGET = { sales: 48_632_000, tax: 2_315_800, bills: 1_284 };
const TODAY = { sales: 1_248_000, tax: 59_400, bills: 34 };

const Tile = ({ k, v, hint, i }: { k: string; v: string; hint: string; i: number }) => {
  const p = useEnter(10 + i * 4);
  return (
    <div style={{ ...rise(p, 10), background: C.surface, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: C.fg3 }}>{k}</div>
      <div style={{ fontSize: 19, fontWeight: 600, fontFamily: MONO, marginTop: 6, letterSpacing: "-0.02em" }}>{v}</div>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 5 }}>{hint}</div>
    </div>
  );
};

const Row = ({ label, note, amount, share, delay }: { label: string; note: string; amount: string; share: number; delay: number }) => {
  const p = useEnter(delay);
  return (
    <div style={{ ...rise(p, 10), padding: "8px 14px", borderTop: `1px solid ${C.lineSubtle}`, position: "relative" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${share * p}%`, background: C.accentSoft }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, position: "relative" }}>
        <span style={{ fontWeight: 500 }}>{label}</span><span style={{ fontFamily: MONO, fontWeight: 600 }}>{amount}</span>
      </div>
      <div style={{ fontSize: 10, color: C.fg3, marginTop: 2, position: "relative" }}>{note}</div>
    </div>
  );
};

export const Sales = ({ durationInFrames }: { durationInFrames: number }) => {
  const frame = useCurrentFrame();
  const f = (x: number) => at(durationInFrames, x);
  // "Today, this month…" → pills move; "…any days you choose" → the month's numbers grow in.
  const pill = frame < f(0.22) ? 0 : frame < f(0.38) ? 1 : 2;
  const grow = frame >= f(0.38);
  const sales = useCount(TARGET.sales, f(0.38), f(0.58));
  const tax = useCount(TARGET.tax, f(0.38), f(0.58));
  const bills = useCount(TARGET.bills, f(0.38), f(0.58));
  const csv = interpolate(frame, [f(0.84), f(0.87), f(0.92)], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const v = grow ? { sales, tax, bills } : TODAY;
  const avg = v.bills ? Math.round(v.sales / v.bills) : 0;
  const vs = pill === 2 ? "last month" : pill === 1 ? "last week" : "yesterday";
  const range = pill === 0 ? "Sat 5 Sep" : pill === 1 ? "Mon 31 Aug – Sat 5 Sep" : "Tue 1 Sep – Sat 5 Sep";
  return (
    <Scene
      durationInFrames={durationInFrames}
      kicker="Sales & reports"
      title="Know how you did. Today, this month, or any days you choose."
      points={["Sales by channel: dine-in, parcel, Zomato, Swiggy", "Tax by rate — the GST return on one screen", "CSV for your accountant, in one tap"]}
      screen={
        <>
          <TopBar title="Sales" />
          <div style={{ padding: "0 16px", fontSize: 12, color: C.fg3 }}>Cafe Sagar · {range}</div>
          <div style={{ display: "flex", gap: 6, padding: "12px 16px", flexWrap: "wrap" }}>
            {PILLS.map((p, i) => (
              <span key={p} style={{ padding: "7px 12px", borderRadius: 999, fontSize: 12, background: i === pill ? C.surface : "transparent", fontWeight: i === pill ? 600 : 400, color: i === pill ? C.fg : C.muted, boxShadow: i === pill ? "0 1px 2px rgba(35,28,15,0.08)" : undefined, border: `1px solid ${i === pill ? C.line : "transparent"}` }}>{p}</span>
            ))}
          </div>
          <div style={{ margin: "0 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: C.line, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
            <Tile k="Sales" v={inr(v.sales)} hint={`${v.bills} bills · +12% vs ${vs}`} i={0} />
            <Tile k="Before tax" v={inr(v.sales - v.tax)} hint="food and drink" i={1} />
            <Tile k="Tax collected" v={inr(v.tax)} hint="CGST + SGST" i={2} />
            <Tile k="Average bill" v={inr(avg)} hint="per invoice" i={3} />
          </div>
          <Card style={{ margin: "12px 16px 0", overflow: "hidden" }}>
            <div style={{ padding: "10px 14px 6px", fontSize: 12, fontWeight: 600, color: C.fg2 }}>Where the bills came from</div>
            {([["Dine-in", 0.58], ["Parcel", 0.22], ["Zomato", 0.13], ["Swiggy", 0.07]] as const).map(([label, s], i) => (
              <Row key={label} label={label} note={`${Math.round(v.bills * s)} bills · ${Math.round(s * 100)}%`} amount={inr(Math.round(v.sales * s))} share={s * 100} delay={30 + i * 6} />
            ))}
          </Card>
          <Card style={{ margin: "12px 16px 0", overflow: "hidden" }}>
            <div style={{ padding: "8px 8px 6px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.fg2 }}>Tax collected</span>
              <span style={{ height: 30, padding: "0 12px", borderRadius: 8, background: csv ? C.accent : C.surface2, color: csv ? "white" : C.fg, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, transform: `scale(${1 - csv * 0.05})` }}>⤓ CSV</span>
            </div>
            {([["CGST @ 2.5%", 0.5, 40], ["SGST @ 2.5%", 0.5, 40]] as const).map(([label, s, mult], i) => (
              <Row key={label} label={label} note={`on ${inr(Math.round(v.tax * s * mult))} of sales`} amount={inr(Math.round(v.tax * s))} share={s * 100} delay={60 + i * 6} />
            ))}
          </Card>
        </>
      }
    />
  );
};
