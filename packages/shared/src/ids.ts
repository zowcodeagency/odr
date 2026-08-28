import { randomUUID } from "node:crypto";

export type TenantId = string & { readonly __brand: "TenantId" };
export type UserId = string & { readonly __brand: "UserId" };
export type OutletId = string & { readonly __brand: "OutletId" };
export type MenuItemId = string & { readonly __brand: "MenuItemId" };

export const newId = (): string => randomUUID();
export const asTenantId = (s: string) => s as TenantId;
export const asUserId = (s: string) => s as UserId;
export const asOutletId = (s: string) => s as OutletId;
