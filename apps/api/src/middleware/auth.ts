import type { MiddlewareHandler } from "hono";
import { verifyAccessToken } from "@odr/auth";
import { membershipOf, tenantGateOf } from "@odr/db";
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
  // removed staff 401 on their next request, role and outlet changes apply immediately.
  // Independent lookups — one round trip, not two, on every request.
  const [m, gate] = await Promise.all([membershipOf(claims.tid, claims.sub), tenantGateOf(claims.tid)]);
  if (!m) throw new UnauthorizedError("membership revoked");

  // Subscription gate — null end date means the tenant isn't enforced.
  if (isExpired(gate.subscriptionEnd)) {
    throw new DomainError("SUBSCRIPTION_EXPIRED", "subscription expired");
  }

  return runWithContext(
    {
      tenantId: asTenantId(claims.tid),
      userId: asUserId(claims.sub),
      role: m.role as typeof claims.role,
      ...(m.outletId ? { outletId: m.outletId } : {}),
      localBilling: gate.localBilling,
    },
    () => next(),
  );
};
