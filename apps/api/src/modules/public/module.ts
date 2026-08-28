import type { DB } from "@odr/db";
import type { MenuService } from "../menu/service.ts";
import type { OrderingService } from "../ordering/service.ts";
import { drizzlePublicRepo } from "./repo.drizzle.ts";
import { makePublicService } from "./service.ts";
import { buildPublicRoutes } from "./routes.ts";

export const publicModule = ({ db, menu, ordering }: { db: DB; menu: MenuService; ordering: OrderingService }) => {
  const svc = makePublicService({ repo: drizzlePublicRepo(db), menu, ordering });
  return { routes: buildPublicRoutes(svc), service: svc };
};
