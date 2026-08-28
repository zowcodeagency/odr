import { connect } from "node:net";
import type { PrinterTransport } from "../index.ts";

export class NetworkTransport implements PrinterTransport {
  readonly name = "network";
  constructor(
    private readonly host: string,
    private readonly port: number = 9100,
    /** Thermal printers answer instantly or not at all — fail fast, don't hang the request. */
    private readonly timeoutMs: number = 2000,
  ) {}

  send(payload: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = connect({ host: this.host, port: this.port }, () => {
        sock.write(payload, (err) => {
          if (err) return reject(err);
          sock.end();
        });
      });
      sock.setTimeout(this.timeoutMs, () => {
        sock.destroy();
        reject(new Error(`printer ${this.host}:${this.port} timed out after ${this.timeoutMs}ms`));
      });
      sock.on("end", () => resolve());
      sock.on("error", reject);
    });
  }
}
