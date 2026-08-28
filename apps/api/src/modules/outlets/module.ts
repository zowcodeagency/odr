import type { DB } from "@odr/db";
import type { EventBus } from "@odr/events";
import { drizzleOutletsRepo } from "./repo.drizzle.ts";
import { makeOutletsService } from "./service.ts";
import { buildOutletsRoutes, buildTablesRoutes } from "./routes.ts";

export const outletsModule = ({ db, events }: { db: DB; events: EventBus }) => {
  const repo = drizzleOutletsRepo(db);
  const svc = makeOutletsService({ repo, events });
  return { routes: buildOutletsRoutes(svc), tableRoutes: buildTablesRoutes(svc), service: svc };
};
