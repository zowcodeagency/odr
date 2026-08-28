import type { DB } from "@odr/db";
import type { MenuService } from "../menu/service.ts";
import { drizzleAdminRepo } from "./repo.drizzle.ts";
import { makeAdminService } from "./service.ts";
import { buildAdminRoutes } from "./routes.ts";

export const adminModule = ({ db, menu }: { db: DB; menu: MenuService }) => {
  const svc = makeAdminService({ repo: drizzleAdminRepo(db), menu });
  return { routes: buildAdminRoutes(svc), service: svc };
};
