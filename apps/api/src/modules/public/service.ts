import { Money, NotFoundError, ValidationError, asTenantId, asUserId } from "@odr/shared";
import { runWithContext } from "@odr/tenancy";
import type { MenuService } from "../menu/service.ts";
import type { OrderingService } from "../ordering/service.ts";
import { orderCode, orderTotalMinor } from "../ordering/domain.ts";
import type { PublicRepo, PublicOutlet } from "./ports.ts";
import { resolveLine } from "./domain.ts";

export type PublicServiceDeps = { repo: PublicRepo; menu: MenuService; ordering: OrderingService };

// Diners have no account. Public writes run as a captain-equivalent actor so
// RBAC still applies (order:create yes, billing:settle no).
const DINER_ACTOR = "00000000-0000-0000-0000-0000000000d1";

const asDiner = async <T>(outlet: PublicOutlet, fn: () => Promise<T>): Promise<T> =>
  runWithContext(
    { tenantId: asTenantId(outlet.tenantId), userId: asUserId(DINER_ACTOR), role: "captain" },
    fn,
  );

export const makePublicService = ({ repo, menu, ordering }: PublicServiceDeps) => {
  /** A wrong or missing token is indistinguishable from a wrong outlet id: 404. */
  const authed = async (outletId: string, token: string): Promise<PublicOutlet> => {
    const outlet = await repo.outletById(outletId);
    if (!outlet?.publicToken || outlet.publicToken !== token) throw new NotFoundError("outlet", outletId);
    return outlet;
  };

  return {
    async menu(outletId: string, token: string) {
      const outlet = await authed(outletId, token);
      return asDiner(outlet, async () => {
        const [categories, items] = await Promise.all([
          menu.listCategories(outletId),
          menu.listItems({ outletId }),
        ]);
        return {
          outlet: { name: outlet.name },
          categories: categories
            .filter((c) => c.isActive)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
            .map((c) => ({
              id: c.id,
              name: c.name,
              items: items
                .filter((i) => i.categoryId === c.id && i.isActive)
                .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
                .map((i) => ({
                  id: i.id,
                  name: i.name,
                  price: Money.of(i.basePrice, "INR").toMajor(),
                  priceMinor: Money.of(i.basePrice, "INR").minor.toString(),
                  isVeg: i.isVeg,
                  description: i.description,
                  hasImage: i.hasImage,
                })),
            }))
            .filter((c) => c.items.length > 0),
        };
      });
    },

    /** Photo bytes for one dish. Tokenless — dish photos are public content. */
    itemImage: (itemId: string) => menu.itemImage(itemId),

    async placeOrder(
      outletId: string,
      input: { token: string; tableLabel: string; customerName?: string; lines: Array<{ itemId: string; qty: number; note?: string }> },
    ) {
      const outlet = await authed(outletId, input.token);
      return asDiner(outlet, async () => {
        const byId = new Map((await menu.listItems({ outletId })).map((i) => [i.id, i]));
        // Reject rather than silently drop: a diner who ordered four things
        // must not be handed a bill for three without being told.
        const unavailable = input.lines
          .filter((l) => resolveLine(byId.get(l.itemId)) === null)
          .map((l) => byId.get(l.itemId)?.name ?? l.itemId);
        if (unavailable.length > 0) {
          throw new ValidationError("some items are no longer available", { unavailable });
        }
        const lines = input.lines.map((l) => ({
          itemId: l.itemId,
          qty: l.qty,
          ...(l.note ? { note: l.note } : {}),
          ...resolveLine(byId.get(l.itemId))!,
          modifiers: [],
        }));
        if (lines.length === 0) throw new ValidationError("no orderable items in this order");

        const order = await ordering.openTable({
          outletId,
          tableLabel: input.tableLabel,
          channel: "qr",
          customerName: input.customerName ?? null,
        });
        await ordering.addItems({ orderId: order.id, lines });
        return { orderId: order.id, code: orderCode(order.id) };
      });
    },

    async orderStatus(orderId: string, token: string) {
      const outlet = await repo.outletForOrder(orderId);
      if (!outlet?.publicToken || outlet.publicToken !== token) throw new NotFoundError("order", orderId);
      return asDiner(outlet, async () => {
        const order = await ordering.byId(orderId);
        if (!order) throw new NotFoundError("order", orderId);
        return {
          status: order.state,
          tableLabel: order.tableLabel,
          totalMinor: orderTotalMinor(order.lines).toString(),
          lines: order.lines.map((l) => ({ itemName: l.itemName, qty: l.qty })),
        };
      });
    },
  };
};

export type PublicService = ReturnType<typeof makePublicService>;
