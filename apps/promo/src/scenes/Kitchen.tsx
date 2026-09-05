import { interpolate, useCurrentFrame } from "remotion";
import { C, MONO } from "../theme.ts";
import { Scene } from "../ui/Layout.tsx";
import { Card, GreenButton, TopBar } from "../ui/Phone.tsx";
import { rise, useEnter } from "../ui/motion.ts";

const ITEMS: [string, number, string][] = [["Masala Dosa", 2, "₹240.00"], ["Filter Coffee", 2, "₹80.00"], ["Veg Pulao", 1, "₹180.00"]];
const SWITCH = 165; // frame where the order screen gives way to the kitchen screen

const OrderScreen = () => {
  const frame = useCurrentFrame();
  const pressed = interpolate(frame, [125, 133, 150], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      <TopBar title="Table 4" />
      <div style={{ padding: "0 16px", fontSize: 12, color: C.fg3 }}>Dine-in · 2 guests · opened just now</div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {ITEMS.map(([name, qty, price], i) => <Line key={name} name={name} qty={qty} price={price} delay={20 + i * 28} />)}
      </div>
      <div style={{ position: "absolute", left: 16, right: 16, bottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.fg3, marginBottom: 10 }}>
          <span>3 items</span><span style={{ fontFamily: MONO, color: C.fg }}>₹500.00</span>
        </div>
        <GreenButton pressed={pressed}>Fire KOT to kitchen</GreenButton>
      </div>
    </>
  );
};

const Line = ({ name, qty, price, delay }: { name: string; qty: number; price: string; delay: number }) => {
  const p = useEnter(delay);
  return (
    <Card style={{ ...rise(p, 14), padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 10, height: 10, border: `2px solid ${C.settled}`, borderRadius: 2, position: "relative", flexShrink: 0 }}>
        <span style={{ position: "absolute", inset: 2, borderRadius: "50%", background: C.settled }} />
      </span>
      <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{name}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface2, borderRadius: 999, padding: "4px 10px", fontSize: 14 }}>
        <span style={{ color: C.fg3 }}>−</span><span style={{ fontWeight: 600, minWidth: 10, textAlign: "center" }}>{qty}</span><span style={{ color: C.accent }}>+</span>
      </span>
      <span style={{ fontFamily: MONO, fontSize: 14, minWidth: 72, textAlign: "right" }}>{price}</span>
    </Card>
  );
};

const KitchenScreen = () => {
  const frame = useCurrentFrame() - SWITCH;
  const p = useEnter(SWITCH + 4, 16);
  const bump = interpolate(frame, [120, 130], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      <TopBar title="Kitchen" />
      <div style={{ padding: "0 16px", fontSize: 12, color: C.fg3 }}>2 tickets waiting</div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <Card style={{ ...rise(p, 40), overflow: "hidden", opacity: p * (1 - bump * 0.6), transform: `translateY(${(1 - p) * 40}px) scale(${1 - bump * 0.04})` }}>
          <div style={{ height: 6, background: C.firing }} />
          <div style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 18, fontWeight: 700 }}>Table 4</span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: C.fg3 }}>KOT 14 · 0m</span>
            </div>
            {ITEMS.map(([name, qty]) => (
              <div key={name} style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 16 }}>
                <span style={{ fontFamily: MONO, fontWeight: 600, color: C.accent }}>{qty}×</span><span>{name}</span>
              </div>
            ))}
            <div style={{ marginTop: 14, height: 44, borderRadius: 10, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: C.accent, background: bump ? C.accentSoft : C.surface }}>
              Done ✓
            </div>
          </div>
        </Card>
        <Card style={{ overflow: "hidden", opacity: 0.7 }}>
          <div style={{ height: 6, background: C.fired }} />
          <div style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 18, fontWeight: 700 }}>Parcel · Ravi</span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: C.fg3 }}>KOT 13 · 4m</span>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 16 }}><span style={{ fontFamily: MONO, fontWeight: 600, color: C.accent }}>1×</span><span>Chicken Biryani</span></div>
          </div>
        </Card>
      </div>
    </>
  );
};

export const Kitchen = ({ durationInFrames }: { durationInFrames: number }) => {
  const frame = useCurrentFrame();
  return (
    <Scene
      durationInFrames={durationInFrames}
      kicker="Order to kitchen"
      title="Take the order. Fire it. The kitchen sees it instantly."
      points={["Kitchen screen or thermal printer, your choice", "Tickets turn amber as they wait", "Opened a table by mistake? Void it in a tap"]}
      screen={frame < SWITCH ? <OrderScreen /> : <KitchenScreen />}
    />
  );
};
