import type { Role } from "@odr/auth";

export type UserAccount = {
  id: string;
  email: string;
  fullName: string;
};

export type TenantMembership = {
  tenantId: string;
  tenantName: string;
  userId: string;
  role: Role;
};

export type StaffMember = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
};
