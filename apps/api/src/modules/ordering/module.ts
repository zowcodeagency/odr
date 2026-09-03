import type { DB } from "@odr/db";
import type { EventBus } from "@odr/events";
import { drizzleOrderRepo } from "./repo.drizzle.ts";
import { makeOrderingService, type OrderingServiceDeps } from "./service.ts";
import { buildOrderingRoutes } from "./routes.ts";

export const orderingModule = ({
  db,
  events,
  outletActive,
}: {
  db: DB;
  events: EventBus;
  outletActive?: OrderingServiceDeps["outletActive"];
}) => {
  const repo = drizzleOrderRepo(db);
  const svc = makeOrderingService({ repo, events, outletActive });
  return { routes: buildOrderingRoutes(svc), service: svc };
};
