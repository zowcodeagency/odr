export type ReceiptLine =
  | { kind: "text"; text: string; bold?: boolean; align?: "left" | "center" | "right" }
  | { kind: "rule" }
  | { kind: "feed"; lines: number }
  | { kind: "cut" };

export type Receipt = {
  header: ReceiptLine[];
  body: ReceiptLine[];
  footer: ReceiptLine[];
};

export interface PrinterTransport {
  readonly name: string;
  send(payload: Uint8Array): Promise<void>;
}

export interface ReceiptRenderer {
  render(receipt: Receipt): Uint8Array;
}

export { EscPosRenderer } from "./escpos.ts";
export { NullTransport } from "./transport/null.ts";
