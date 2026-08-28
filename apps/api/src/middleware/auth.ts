import type { MiddlewareHandler } from "hono";
import { verifyAccessToken } from "@odr/auth";
import { membershipRoleOf, subscriptionEndOf } from "@odr/db";
import { DomainError, UnauthorizedError, asTenantId, asUserId } from "@odr/shared";
import { runWithContext } from "@odr/tenancy";
import { isExpired } from "../modules/admin/domain.ts";

const secret = process.env.JWT_SECRET ?? "dev-only-change-me";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) throw new UnauthorizedError("missing bearer token");
  const token = header.slice("Bearer ".length);

  const claims = await verifyAccessToken(token, secret).catch(() => {
    throw new UnauthorizedError("invalid token");
  });

  // Tokens live 30 days, so the membership row is the source of truth:
  // removed staff 401 on their next request, role changes apply immediately.
  const role = await membershipRoleOf(claims.tid, claims.sub);
  if (!role) throw new UnauthorizedError("membership revoked");

  // Subscription gate — null end date means the tenant isn't enforced.
  if (isExpired(await subscriptionEndOf(claims.tid))) {
    throw new DomainError("SUBSCRIPTION_EXPIRED", "subscription expired");
  }

  return runWithContext(
    { tenantId: asTenantId(claims.tid), userId: asUserId(claims.sub), role: role as typeof claims.role },
    () => next(),
  );
};
