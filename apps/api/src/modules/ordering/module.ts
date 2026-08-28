import type { DB } from "@odr/db";
import type { EventBus } from "@odr/events";
import { drizzleOrderRepo } from "./repo.drizzle.ts";
import { makeOrderingService } from "./service.ts";
import { buildOrderingRoutes } from "./routes.ts";

export const orderingModule = ({ db, events }: { db: DB; events: EventBus }) => {
  const repo = drizzleOrderRepo(db);
  const svc = makeOrderingService({ repo, events });
  return { routes: buildOrderingRoutes(svc), service: svc };
};
