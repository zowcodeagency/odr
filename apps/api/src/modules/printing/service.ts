import { DomainError, ForbiddenError, NotFoundError } from "@odr/shared";
import { can } from "@odr/auth";
import { assertOutletScope, getContext } from "@odr/tenancy";
import { EscPosRenderer, type Receipt } from "@odr/printing";
import { NetworkTransport } from "@odr/printing/transport/network";
import type { OutletsService } from "../outlets/service.ts";
import type { OrderingService } from "../ordering/service.ts";
import type { BillingService } from "../billing/service.ts";
import { billReceipt, columnsFor, kotReceipt } from "./domain.ts";

/** 409 {"error":"NO_PRINTER"} — frozen; the PWA falls back to browser print on it. */
export class NoPrinterError extends DomainError {
  constructor(reason: string) {
    super("NO_PRINTER", reason);
  }
}

export type PrintServiceDeps = {
  outlets: OutletsService;
  ordering: OrderingService;
  billing: BillingService;
  /** Swappable for tests / a future USB sidecar. */
  send?: (host: string, port: number, payload: Uint8Array) => Promise<void>;
};

const renderer = new EscPosRenderer();

export const makePrintService = ({ outlets, ordering, billing, send }: PrintServiceDeps) => {
  const deliver = async (outletId: string, receipt: Receipt) => {
    const outlet = await outlets.byId(outletId);
    if (!outlet) throw new NotFoundError("outlet", outletId);
    if (!outlet.printerIp) throw new NoPrinterError("no network printer configured for this outlet");

    const payload = renderer.render(receipt);
    try {
      await (send
        ? send(outlet.printerIp, outlet.printerPort, payload)
        : new NetworkTransport(outlet.printerIp, outlet.printerPort).send(payload));
    } catch (err) {
      throw new NoPrinterError(`printer unreachable: ${(err as Error).message}`);
    }
  };

  const outletOf = async (outletId: string) => {
    const o = await outlets.byId(outletId);
    if (!o) throw new NotFoundError("outlet", outletId);
    return o;
  };

  return {
    async printKot(kotId: string) {
      if (!can(getContext().role, "order:read")) throw new ForbiddenError("cannot print KOTs");
      const kot = await ordering.kotById(kotId);
      if (!kot) throw new NotFoundError("kot", kotId);
      const order = await ordering.byId(kot.orderId);
      if (!order) throw new NotFoundError("order", kot.orderId);
      const outlet = await outletOf(order.outletId);
      await deliver(outlet.id, kotReceipt(outlet.name, kot, columnsFor(outlet.paperWidth)));
    },

    async testPrint(outletId: string) {
      if (!can(getContext().role, "outlet:write")) throw new ForbiddenError("cannot test print");
      assertOutletScope(outletId);
      const outlet = await outletOf(outletId);
      await deliver(outlet.id, {
        header: [{ kind: "text", text: "ODR TEST PRINT", bold: true, align: "center" }],
        body: [{ kind: "text", text: outlet.name, align: "center" }],
        footer: [{ kind: "text", text: "Printer connected successfully", align: "center" }],
      });
    },

    async printBill(billId: string) {
      if (!can(getContext().role, "billing:read")) throw new ForbiddenError("cannot print bills");
      const bill = await billing.byId(billId);
      if (!bill) throw new NotFoundError("bill", billId);
      const outlet = await outletOf(bill.outletId);
      await deliver(outlet.id, billReceipt(outlet, bill, columnsFor(outlet.paperWidth)));
    },
  };
};

export type PrintService = ReturnType<typeof makePrintService>;
