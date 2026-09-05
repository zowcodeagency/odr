import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, MONO } from "../theme.ts";
import { Scene } from "../ui/Layout.tsx";
import { GreenButton, TopBar } from "../ui/Phone.tsx";
import { Qr } from "../ui/Qr.tsx";
import { useEnter } from "../ui/motion.ts";

const LINES: [string, number, string][] = [["Masala Dosa", 2, "240.00"], ["Filter Coffee", 2, "80.00"], ["Veg Pulao", 1, "180.00"]];
const INVOICE = "CS/2026-27/00184";

/** The printed bill, in screen pixels. `zoom` scales type for the big aside copy. */
export const Receipt = ({ zoom = 1, width = 340 }: { zoom?: number; width?: number }) => {
  const frame = useCurrentFrame();
  const typed = INVOICE.slice(0, Math.floor(interpolate(frame, [20, 60], [0, INVOICE.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const qr = useEnter(70, 14);
  const total = useEnter(52);
  const f = (n: number) => n * zoom;
  const Row = ({ l, r, bold = false, dim = false }: { l: string; r: string; bold?: boolean; dim?: boolean }) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: f(bold ? 15 : 12), fontWeight: bold ? 700 : 400, color: dim ? C.fg3 : C.ink, marginTop: f(5) }}>
      <span>{l}</span><span style={{ fontFamily: MONO }}>{r}</span>
    </div>
  );
  return (
    <div style={{ width: f(width), background: C.paper, color: C.ink, padding: f(18), borderRadius: 4, boxShadow: "0 18px 40px -20px rgba(35,28,15,0.35), 0 0 0 1px rgba(0,0,0,0.06)", fontFamily: MONO }}>
      <div style={{ textAlign: "center", fontSize: f(16), fontWeight: 700, letterSpacing: "0.02em" }}>CAFE SAGAR</div>
      <div style={{ textAlign: "center", fontSize: f(10), color: C.fg3, marginTop: f(3) }}>Balmatta Road, Mangaluru 575002<br />GSTIN 29ABCDE1234F1Z5</div>
      <div style={{ borderTop: `1px dashed ${C.line}`, margin: `${f(10)}px 0` }} />
      <Row l="Invoice" r={typed || " "} />
      <Row l="Table" r="T-4" />
      <Row l="Date" r="05/09/2026, 13:42" />
      <div style={{ borderTop: `1px dashed ${C.line}`, margin: `${f(10)}px 0` }} />
      {LINES.map(([n, q, a]) => <Row key={n} l={`${q} × ${n}`} r={a} />)}
      <div style={{ borderTop: `1px dashed ${C.line}`, margin: `${f(10)}px 0` }} />
      <Row l="Subtotal" r="500.00" />
      <Row l="CGST @ 2.50%" r="12.50" dim />
      <Row l="SGST @ 2.50%" r="12.50" dim />
      <div style={{ opacity: total, transform: `scale(${0.96 + total * 0.04})`, transformOrigin: "right" }}>
        <Row l="TOTAL" r="₹525.00" bold />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: f(14), opacity: qr, transform: `scale(${0.8 + qr * 0.2})` }}>
        <Qr size={f(112)} seed={11} />
        <div style={{ fontSize: f(10), color: C.fg3, marginTop: f(6), textAlign: "center" }}>Scan to pay ₹525.00 · cafesagar@upi</div>
      </div>
      <div style={{ textAlign: "center", fontSize: f(10), color: C.fg3, marginTop: f(12) }}>Thank you · come again</div>
    </div>
  );
};

export const Bill = ({ durationInFrames }: { durationInFrames: number }) => {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  return (
    <Scene
      durationInFrames={durationInFrames}
      kicker="The bill"
      title="Settle in a tap. GST done. Scan to pay."
      points={["Tax worked out per rate, the way the return needs it", "Invoice numbers in sequence, per outlet, per year", "Print to any printer — 58 or 80 mm"]}
      screen={
        <>
          <TopBar title={INVOICE.split("/").pop() ?? ""} />
          <div style={{ padding: "0 16px", fontSize: 12, color: C.fg3 }}>Settled · Table 4 · 05/09/2026, 13:42</div>
          <div style={{ padding: "14px 24px 0", display: "flex", justifyContent: "center" }}>
            <Receipt zoom={portrait ? 1 : 0.9} width={portrait ? 340 : 360} />
          </div>
          <div style={{ position: "absolute", left: 16, right: 16, bottom: 28, display: "flex", gap: 10 }}>
            <div style={{ flex: 1, height: 52, borderRadius: 12, border: `1px solid ${C.line}`, background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600 }}>Kitchen printer</div>
            <GreenButton style={{ flex: 1 }}>Print</GreenButton>
          </div>
        </>
      }
    />
  );
};
