import { ForbiddenError, NotFoundError, ValidationError, newId } from "@odr/shared";
import { can } from "@odr/auth";
import type { EventBus } from "@odr/events";
import { getContext } from "@odr/tenancy";
import type { OrderRepo, KotView } from "./ports.ts";
import {
  assertTransition,
  requiresTable,
  type Kot,
  type Order,
  type OrderChannel,
  type OrderLine,
} from "./domain.ts";

export type OrderingServiceDeps = { repo: OrderRepo; events: EventBus };

const emit = async (events: EventBus, name: string, tenantId: string, payload: unknown) =>
  events.publish({ name, tenantId, occurredAt: new Date().toISOString(), payload });

export const makeOrderingService = ({ repo, events }: OrderingServiceDeps) => ({
  async openTable(input: {
    outletId: string;
    tableLabel?: string | null;
    channel?: OrderChannel;
    customerName?: string | null;
    aggregatorRef?: string | null;
  }): Promise<Order> {
    const ctx = getContext();
    if (!can(ctx.role, "order:create")) throw new ForbiddenError("cannot open orders");

    const channel = input.channel ?? "dine_in";
    if (requiresTable(channel) && !input.tableLabel) {
      throw new ValidationError("tableLabel is required for dine_in orders", { channel });
    }

    const order: Order = {
      id: newId(),
      tenantId: ctx.tenantId,
      outletId: input.outletId,
      tableLabel: requiresTable(channel) ? input.tableLabel! : (input.tableLabel ?? null),
      channel,
      customerName: input.customerName ?? null,
      aggregatorRef: input.aggregatorRef ?? null,
      state: "open",
      lines: [],
      kots: [],
      openedAt: new Date().toISOString(),
    };
    const saved = await repo.insert(order);
    await emit(events, "order.opened", ctx.tenantId, { orderId: saved.id, outletId: saved.outletId, tableLabel: saved.tableLabel, channel: saved.channel });
    return saved;
  },

  async addItems(input: { orderId: string; lines: Array<Omit<OrderLine, "id">> }): Promise<Order> {
    const ctx = getContext();
    if (!can(ctx.role, "order:create")) throw new ForbiddenError("cannot add items");

    const order = await repo.byId(ctx.tenantId, input.orderId);
    if (!order) throw new NotFoundError("order", input.orderId);

    assertTransition(order.state, "items_added");
    const newLines: OrderLine[] = input.lines.map((l) => ({ ...l, id: newId() }));
    order.lines.push(...newLines);
    order.state = "items_added";

    const saved = await repo.save(order);
    await emit(events, "order.items_added", ctx.tenantId, { orderId: order.id, addedLineIds: newLines.map((l) => l.id) });
    return saved;
  },

  async fireKot(input: { orderId: string }): Promise<Order> {
    const ctx = getContext();
    if (!can(ctx.role, "order:fire-kot")) throw new ForbiddenError("cannot fire KOT");

    const order = await repo.byId(ctx.tenantId, input.orderId);
    if (!order) throw new NotFoundError("order", input.orderId);

    assertTransition(order.state, "kot_fired");
    const fired = new Set(order.kots.flatMap((k) => k.lineIds));
    const kot: Kot = {
      id: newId(),
      number: await repo.nextKotNumber(ctx.tenantId, order.outletId),
      firedAt: new Date().toISOString(),
      lineIds: order.lines.map((l) => l.id).filter((id) => !fired.has(id)),
    };
    order.kots.push(kot);
    order.state = "kot_fired";
    order.kotFiredAt = kot.firedAt;

    const saved = await repo.save(order);
    await emit(events, "order.kot_fired", ctx.tenantId, { orderId: order.id, kotId: kot.id, lines: order.lines });
    return saved;
  },

  async settle(input: { orderId: string }): Promise<Order> {
    const ctx = getContext();
    if (!can(ctx.role, "billing:settle")) throw new ForbiddenError("cannot settle");

    const order = await repo.byId(ctx.tenantId, input.orderId);
    if (!order) throw new NotFoundError("order", input.orderId);

    assertTransition(order.state, "settled");
    order.state = "settled";
    order.settledAt = new Date().toISOString();

    const saved = await repo.save(order);
    await emit(events, "order.settled", ctx.tenantId, { orderId: order.id });
    return saved;
  },

  async void(input: { orderId: string }): Promise<Order> {
    const ctx = getContext();
    if (!can(ctx.role, "order:void")) throw new ForbiddenError("cannot void orders");

    const order = await repo.byId(ctx.tenantId, input.orderId);
    if (!order) throw new NotFoundError("order", input.orderId);

    assertTransition(order.state, "voided");
    order.state = "voided";

    const saved = await repo.save(order);
    await emit(events, "order.voided", ctx.tenantId, { orderId: order.id });
    return saved;
  },

  async kotDone(input: { kotId: string }): Promise<KotView> {
    const ctx = getContext();
    if (!can(ctx.role, "order:read")) throw new ForbiddenError("cannot bump KOTs");
    const kot = await repo.markKotDone(ctx.tenantId, input.kotId);
    if (!kot) throw new NotFoundError("kot", input.kotId);
    await emit(events, "order.kot_done", ctx.tenantId, { kotId: kot.id, orderId: kot.orderId });
    return kot;
  },

  listOpen: (outletId: string) => repo.listOpen(getContext().tenantId, outletId),
  byId: (id: string) => repo.byId(getContext().tenantId, id),
  listPendingKots: (outletId: string) => repo.listPendingKots(getContext().tenantId, outletId),
  kotById: (kotId: string) => repo.kotById(getContext().tenantId, kotId),
});

export type OrderingService = ReturnType<typeof makeOrderingService>;
