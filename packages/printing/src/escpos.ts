import type { Receipt, ReceiptLine, ReceiptRenderer } from "./index.ts";

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const cmd = {
  init: () => Uint8Array.from([ESC, 0x40]),
  bold: (on: boolean) => Uint8Array.from([ESC, 0x45, on ? 1 : 0]),
  align: (a: "left" | "center" | "right") => Uint8Array.from([ESC, 0x61, a === "left" ? 0 : a === "center" ? 1 : 2]),
  feed: (n: number) => Uint8Array.from([ESC, 0x64, Math.max(0, Math.min(255, n))]),
  cut: () => Uint8Array.from([GS, 0x56, 0x00]),
};

const concat = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

const enc = new TextEncoder();

const renderLine = (l: ReceiptLine): Uint8Array => {
  switch (l.kind) {
    case "text": {
      const parts = [cmd.align(l.align ?? "left"), cmd.bold(!!l.bold), enc.encode(l.text), Uint8Array.from([LF])];
      return concat(parts);
    }
    case "rule":
      return enc.encode("--------------------------------\n");
    case "feed":
      return cmd.feed(l.lines);
    case "cut":
      return cmd.cut();
  }
};

export class EscPosRenderer implements ReceiptRenderer {
  render(receipt: Receipt): Uint8Array {
    const all = [cmd.init(), ...receipt.header.map(renderLine), ...receipt.body.map(renderLine), ...receipt.footer.map(renderLine), cmd.feed(3), cmd.cut()];
    return concat(all);
  }
}
