import { Hono } from "hono";
import { db } from "@odr/db";
import { InMemoryEventBus } from "@odr/events";
import { errorHandler } from "./middleware/error.ts";
import { authMiddleware } from "./middleware/auth.ts";
import { identityModule } from "./modules/identity/module.ts";
import { menuModule } from "./modules/menu/module.ts";
import { outletsModule } from "./modules/outlets/module.ts";
import { orderingModule } from "./modules/ordering/module.ts";
import { billingModule } from "./modules/billing/module.ts";
import { adminModule } from "./modules/admin/module.ts";
import { buildSetupRoutes } from "./modules/admin/setup.ts";
import { drizzleAdminRepo } from "./modules/admin/repo.drizzle.ts";
import { publicModule } from "./modules/public/module.ts";
import { printingModule } from "./modules/printing/module.ts";
import { buildBrandingRoutes } from "./modules/branding/routes.ts";

export const buildApp = async (opts: { setup?: boolean } = {}) => {
  const app = new Hono();
  const events = new InMemoryEventBus();

  app.onError(errorHandler);
  app.get("/health", (c) => c.json({ ok: true }));

  const identity = identityModule({ db, events });
  app.route("/auth", identity.publicRoutes);

  const menu = menuModule({ db, events });

  // Internal team surface — ADMIN_KEY bearer auth, no tenant JWT.
  const admin = adminModule({ db, menu: menu.service });
  app.route("/admin", admin.routes);
  // Box only: first-run restaurant creation, no auth, closes itself after the first tenant.
  if (opts.setup) app.route("/", buildSetupRoutes(admin.service, drizzleAdminRepo(db)));

  const outlets = outletsModule({ db, events });
  const ordering = orderingModule({ db, events, outletActive: outlets.service.activeInTenant });

  // Diner QR surface — no JWT, gated by the outlet's public_token.
  app.route("/public", publicModule({ db, menu: menu.service, ordering: ordering.service }).routes);

  const protectedApp = new Hono();
  protectedApp.use("*", authMiddleware);
  protectedApp.route("/me", identity.privateRoutes);
  protectedApp.route("/staff", identity.staffRoutes);
  protectedApp.route("/menu", menu.routes);
  protectedApp.route("/outlets", outlets.routes);
  protectedApp.route("/tables", outlets.tableRoutes);
  protectedApp.route("/branding", buildBrandingRoutes());
  protectedApp.route("/ordering", ordering.routes);

  // Billing reads orders via an OrderLookup adapter that maps the ordering
  // domain to a slim "settleable" projection. Keeps modules decoupled — the
  // billing module never imports from ordering directly.
  const billing = billingModule({
    db,
    events,
    country: () => process.env.DEFAULT_COUNTRY ?? "IN",
    orders: {
      byIdForBilling: async (tenantId, orderId) => {
        const o = await ordering.service.byId(orderId);
        if (!o || o.tenantId !== tenantId) return null;
        return {
          id: o.id,
          outletId: o.outletId,
          state: o.state,
          channel: o.channel,
          lines: o.lines.map((l) => ({
            itemId: l.itemId,
            itemName: l.itemName,
            qty: l.qty,
            unitPriceMinor: l.unitPriceMinor,
            taxClass: l.taxClass,
          })),
        };
      },
    },
  });
  protectedApp.route("/billing", billing.routes);

  protectedApp.route(
    "/print",
    printingModule({ outlets: outlets.service, ordering: ordering.service, billing: billing.service }).routes,
  );

  app.route("/api/v1", protectedApp);

  return app;
};
