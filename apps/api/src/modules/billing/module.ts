import type { DB } from "@odr/db";
import type { EventBus } from "@odr/events";
import { runWithContext } from "@odr/tenancy";
import { asTenantId, asUserId } from "@odr/shared";
import { drizzleBillingRepo } from "./repo.drizzle.ts";
import { makeBillingService, type OrderLookup } from "./service.ts";
import { buildBillingRoutes } from "./routes.ts";

// Synthetic system identity for event-driven auto-settlement. Uses a fixed
// nil-style UUID so audit logs can distinguish "system" from real users.
// Not a privileged role gate — RBAC still applies, but role="owner" lets
// the billing service settle without rejecting on permission.
const SYSTEM_USER_ID = "00000000-0000-0000-0000-00000000b111";

export type BillingModuleDeps = {
  db: DB;
  events: EventBus;
  country: () => string;
  orders: OrderLookup;
};

export const billingModule = ({ db, events, country, orders }: BillingModuleDeps) => {
  const repo = drizzleBillingRepo(db);
  const svc = makeBillingService({ repo, events, country, orders });

  // Auto-settle: when ordering settles an order, materialize the bill.
  // Idempotent — service short-circuits if a bill already exists for this order.
  events.subscribe<{ orderId: string; localBill?: boolean }>("order.settled", async (e) => {
    if (e.payload.localBill) return; // the device holds this invoice until it syncs
    try {
      await runWithContext(
        { tenantId: asTenantId(e.tenantId), userId: asUserId(SYSTEM_USER_ID), role: "owner" },
        () => svc.settleOrderToBill({ orderId: e.payload.orderId }),
      );
    } catch (err) {
      console.error(`auto-settle failed for order=${e.payload.orderId}:`, err);
    }
  });

  return { routes: buildBillingRoutes(svc), service: svc };
};
