import { makePrintService, type PrintServiceDeps } from "./service.ts";
import { buildPrintRoutes } from "./routes.ts";

export const printingModule = (deps: PrintServiceDeps) => {
  const svc = makePrintService(deps);
  return { routes: buildPrintRoutes(svc), service: svc };
};
