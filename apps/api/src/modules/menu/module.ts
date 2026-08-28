import type { DB } from "@odr/db";
import type { EventBus } from "@odr/events";
import { drizzleMenuRepo } from "./repo.drizzle.ts";
import { makeMenuService } from "./service.ts";
import { buildMenuRoutes } from "./routes.ts";

export const menuModule = ({ db, events }: { db: DB; events: EventBus }) => {
  const repo = drizzleMenuRepo(db);
  const country = () => process.env.DEFAULT_COUNTRY ?? "IN";
  const svc = makeMenuService({ repo, events, country });
  return { routes: buildMenuRoutes(svc), service: svc };
};
