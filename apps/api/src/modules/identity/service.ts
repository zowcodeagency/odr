import { can, hashPassword, verifyPassword, issueAccessToken, type Role } from "@odr/auth";
import { ConflictError, DomainError, ForbiddenError, NotFoundError, UnauthorizedError } from "@odr/shared";
import { getContext } from "@odr/tenancy";
import { isExpired } from "../admin/domain.ts";
import type { IdentityRepo } from "./ports.ts";

export type IdentityServiceDeps = {
  repo: IdentityRepo;
  jwtSecret: string;
};

export const makeIdentityService = ({ repo, jwtSecret }: IdentityServiceDeps) => ({
  async register(input: { email: string; password: string; fullName: string }) {
    const existing = await repo.findUserByEmail(input.email);
    if (existing) throw new ConflictError("email already registered", { email: input.email });
    const passwordHash = await hashPassword(input.password);
    return repo.createUser({ email: input.email, passwordHash, fullName: input.fullName });
  },

  /**
   * tenantId is optional: a user with exactly one membership is logged straight
   * in. Several memberships → `{requiresTenant}` and the client re-posts with a
   * pick. Frozen contract — the captain PWA switches on `requiresTenant`.
   */
  async login(input: { email: string; password: string; tenantId?: string }) {
    const user = await repo.findUserByEmail(input.email);
    if (!user) throw new UnauthorizedError("invalid credentials");
    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedError("invalid credentials");

    const memberships = await repo.listMemberships(user.id);
    if (!input.tenantId && memberships.length > 1) {
      return {
        requiresTenant: true as const,
        tenants: memberships.map((m) => ({ id: m.tenantId, name: m.tenantName })),
      };
    }

    const m = input.tenantId ? memberships.find((x) => x.tenantId === input.tenantId) : memberships[0];
    if (!m) throw new UnauthorizedError("not a member of this tenant");

    const subscriptionEndsAt = await repo.subscriptionEnd(m.tenantId);
    if (isExpired(subscriptionEndsAt)) throw new DomainError("SUBSCRIPTION_EXPIRED", "subscription expired");

    const token = await issueAccessToken({ sub: user.id, tid: m.tenantId, role: m.role as Role }, jwtSecret);
    return {
      token,
      user: { id: user.id, email: user.email, fullName: user.fullName },
      role: m.role,
      subscriptionEndsAt,
    };
  },

  listMemberships: (userId: string) => repo.listMemberships(userId),

  subscriptionEndsAt: (tenantId: string) => repo.subscriptionEnd(tenantId),

  async listStaff() {
    const ctx = getContext();
    if (!can(ctx.role, "user:read")) throw new ForbiddenError("cannot read staff");
    return repo.listStaff(ctx.tenantId);
  },

  /**
   * Adds a staff member to the caller's tenant. An email that already has an
   * account is re-used (people work at two restaurants) — only the membership
   * is created.
   */
  async createStaff(input: { email: string; password: string; fullName: string; role: Role }) {
    const ctx = getContext();
    if (!can(ctx.role, "user:write")) throw new ForbiddenError("cannot write staff");

    const existing = await repo.findUserByEmail(input.email);
    const user = existing ?? (await repo.createUser({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      fullName: input.fullName,
    }));
    if (existing && (await repo.listMemberships(user.id)).some((m) => m.tenantId === ctx.tenantId)) {
      throw new ConflictError("already a staff member", { email: input.email });
    }
    await repo.addMembership(ctx.tenantId, user.id, input.role);
    return { id: user.id, email: user.email, fullName: user.fullName, role: input.role };
  },

  /**
   * Revokes a staff member's access to this restaurant. Two guards that matter
   * on a real floor: you cannot remove yourself (instant lock-out), and you
   * cannot remove the last owner (nobody left who can manage staff).
   */
  async removeStaff(userId: string) {
    const ctx = getContext();
    if (!can(ctx.role, "user:write")) throw new ForbiddenError("cannot write staff");
    if (userId === ctx.userId) throw new ConflictError("you cannot remove yourself");

    const staff = await repo.listStaff(ctx.tenantId);
    const target = staff.find((s) => s.id === userId);
    if (!target) throw new NotFoundError("staff member", userId);
    if (target.role === "owner" && staff.filter((s) => s.role === "owner").length === 1) {
      throw new ConflictError("the last owner cannot be removed");
    }

    await repo.removeMembership(ctx.tenantId, userId);
  },
});

export type IdentityService = ReturnType<typeof makeIdentityService>;
