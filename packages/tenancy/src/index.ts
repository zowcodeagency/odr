import { AsyncLocalStorage } from "node:async_hooks";
import type { TenantId, UserId } from "@odr/shared";

export type RequestContext = {
  tenantId: TenantId;
  userId: UserId;
  role: "owner" | "manager" | "captain" | "cashier" | "kitchen";
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
