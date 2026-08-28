import type { PrinterTransport } from "../index.ts";

export class NullTransport implements PrinterTransport {
  readonly name = "null";
  readonly sent: Uint8Array[] = [];
  async send(payload: Uint8Array): Promise<void> {
    this.sent.push(payload);
  }
}
