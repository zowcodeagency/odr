import type { MenuMode } from "@odr/db/schema";

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
  localBilling: boolean;
  createdAt: string;
  outletCount: number;
};

export type OutletRow = {
  id: string;
  name: string;
  code: string;
  gstin: string | null;
  city: string;
  invoicePrefix: string;
  isActive: boolean;
  menuMode: MenuMode;
  createdAt: string;
};

export type TopupRow = {
  id: string;
  amountMinor: string;
  monthsAdded: number;
  note: string | null;
  createdAt: string;
};

export interface AdminRepo {
  slugExists(slug: string): Promise<boolean>;
  createTenant(input: {
    name: string;
    slug: string;
    subscriptionStart: string;
    subscriptionEnd: string;
  }): Promise<TenantRow>;
  listTenants(): Promise<TenantRow[]>;
  tenantById(id: string): Promise<TenantRow | null>;
  setSubscriptionEnd(tenantId: string, end: string): Promise<void>;
  setLocalBilling(tenantId: string, on: boolean): Promise<boolean>;

  listOutlets(tenantId: string): Promise<OutletRow[]>;
  outletCodeExists(tenantId: string, code: string): Promise<boolean>;
  createOutlet(input: {
    tenantId: string;
    name: string;
    code: string;
    gstin?: string;
    address: { line1: string; line2?: string; city: string; state: string; pincode: string; country: string };
    invoicePrefix: string;
    menuMode: MenuMode;
  }): Promise<{ id: string }>;
  setOutletActive(tenantId: string, outletId: string, isActive: boolean): Promise<boolean>;

  /** Reuses an existing account when the email is already registered. */
  upsertOwner(input: { email: string; passwordHash: string; fullName: string }): Promise<{ id: string }>;
  addOwnerMembership(tenantId: string, userId: string): Promise<void>;

  insertTopup(input: {
    tenantId: string;
    amountMinor: string;
    monthsAdded: number;
    note?: string;
  }): Promise<TopupRow>;
  listTopups(tenantId: string): Promise<TopupRow[]>;
}
