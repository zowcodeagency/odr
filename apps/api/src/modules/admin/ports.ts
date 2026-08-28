export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
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

  createOutlet(input: {
    tenantId: string;
    name: string;
    code: string;
    gstin?: string;
    invoicePrefix: string;
  }): Promise<{ id: string }>;

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
