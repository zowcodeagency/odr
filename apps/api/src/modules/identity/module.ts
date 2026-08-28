import type { DB } from "@odr/db";
import type { EventBus } from "@odr/events";
import { drizzleIdentityRepo } from "./repo.drizzle.ts";
import { makeIdentityService } from "./service.ts";
import { buildPublicRoutes, buildPrivateRoutes, buildStaffRoutes } from "./routes.ts";

export const identityModule = ({ db, events: _events }: { db: DB; events: EventBus }) => {
  const repo = drizzleIdentityRepo(db);
  const svc = makeIdentityService({ repo, jwtSecret: process.env.JWT_SECRET ?? "dev-only-change-me" });
  return {
    publicRoutes: buildPublicRoutes(svc),
    privateRoutes: buildPrivateRoutes(svc),
    staffRoutes: buildStaffRoutes(svc),
    service: svc,
  };
};
