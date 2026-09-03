import { AsyncLocalStorage } from "node:async_hooks";
import type { TenantId, UserId } from "@odr/shared";
import { ForbiddenError } from "@odr/shared";

export type RequestContext = {
  tenantId: TenantId;
  userId: UserId;
  role: "owner" | "manager" | "captain" | "cashier" | "kitchen";
  /** Membership pin. undefined = every outlet in the tenant (owner / manager). */
  outletId?: string;
};

const als = new AsyncLocalStorage<RequestContext>();

export const runWithContext = <T>(ctx: RequestContext, fn: () => T | Promise<T>): T | Promise<T> =>
  als.run(ctx, fn);

export const getContext = (): RequestContext => {
  const ctx = als.getStore();
  if (!ctx) throw new Error("no request context");
  return ctx;
};

export const getContextOrNull = (): RequestContext | undefined => als.getStore();

/**
 * Pinned staff (membership.outlet_id set) may only touch that outlet.
 * Owners and managers carry no outletId in context and pass for every outlet.
 */
export const assertOutletScope = (outletId: string): void => {
  const pinned = getContext().outletId;
  if (pinned && pinned !== outletId) throw new ForbiddenError("outlet out of scope");
};
