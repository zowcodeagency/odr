import type { Role } from "@odr/auth";
import type { UserAccount, TenantMembership, StaffMember } from "./domain.ts";

export interface IdentityRepo {
  findUserByEmail(email: string): Promise<(UserAccount & { passwordHash: string }) | null>;
  createUser(input: { email: string; passwordHash: string; fullName: string }): Promise<UserAccount>;
  listMemberships(userId: string): Promise<TenantMembership[]>;
  /** 'YYYY-MM-DD', or null when the tenant has no subscription window set. */
  subscriptionEnd(tenantId: string): Promise<string | null>;

  listStaff(tenantId: string): Promise<StaffMember[]>;
  addMembership(tenantId: string, userId: string, role: Role): Promise<void>;
  /** Revokes access to this tenant. The user account itself survives — they
   *  may still work at another restaurant, and past orders reference them. */
  removeMembership(tenantId: string, userId: string): Promise<void>;
}
