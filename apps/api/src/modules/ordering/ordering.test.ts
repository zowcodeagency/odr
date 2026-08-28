import { test, expect } from "bun:test";
import { InMemoryEventBus } from "@odr/events";
import { runWithContext } from "@odr/tenancy";
import { asTenantId, asUserId, asOutletId } from "@odr/shared";
import { inMemoryOrderRepo } from "./repo.memory.ts";
import { makeOrderingService } from "./service.ts";

const ctx = {
  tenantId: asTenantId("11111111-1111-1111-1111-111111111111"),
  userId: asUserId("22222222-2222-2222-2222-222222222222"),
  role: "owner" as const,
  outletId: "33333333-3333-3333-3333-333333333333",
};

const sampleLine = {
  itemId: "44444444-4444-4444-4444-444444444444",
  itemName: "Masala Dosa",
  qty: 2,
  unitPriceMinor: 12000n,
  taxClass: "GST_5",
  modifiers: [],
};

test("full happy path: open → items → kot → settle", async () => {
  const events = new InMemoryEventBus();
  const seen: string[] = [];
  for (const e of ["order.opened","order.items_added","order.kot_fired","order.settled"]) {
    events.subscribe(e, (ev) => { seen.push(ev.name); });
  }
  const svc = makeOrderingService({ repo: inMemoryOrderRepo(), events });

  await runWithContext(ctx, async () => {
    const o = await svc.openTable({ outletId: asOutletId(ctx.outletId), tableLabel: "T-1" });
    expect(o.state).toBe("open");

    const o2 = await svc.addItems({ orderId: o.id, lines: [sampleLine] });
    expect(o2.state).toBe("items_added");
    expect(o2.lines).toHaveLength(1);

    const o3 = await svc.fireKot({ orderId: o.id });
    expect(o3.state).toBe("kot_fired");
    expect(o3.kotFiredAt).toBeDefined();

    const o4 = await svc.settle({ orderId: o.id });
    expect(o4.state).toBe("settled");
  });

  expect(seen).toEqual(["order.opened","order.items_added","order.kot_fired","order.settled"]);
});

test("illegal transition: open → settle is rejected", async () => {
  const svc = makeOrderingService({ repo: inMemoryOrderRepo(), events: new InMemoryEventBus() });
  await runWithContext(ctx, async () => {
    const o = await svc.openTable({ outletId: asOutletId(ctx.outletId), tableLabel: "T-2" });
    await expect(svc.settle({ orderId: o.id })).rejects.toThrow(/illegal transition/);
  });
});

test("settled order cannot be modified", async () => {
  const svc = makeOrderingService({ repo: inMemoryOrderRepo(), events: new InMemoryEventBus() });
  await runWithContext(ctx, async () => {
    const o = await svc.openTable({ outletId: asOutletId(ctx.outletId), tableLabel: "T-3" });
    await svc.addItems({ orderId: o.id, lines: [sampleLine] });
    await svc.fireKot({ orderId: o.id });
    await svc.settle({ orderId: o.id });
    await expect(svc.addItems({ orderId: o.id, lines: [sampleLine] })).rejects.toThrow(/illegal transition/);
  });
});

test("channel validation: dine_in needs a table, parcel doesn't", async () => {
  const svc = makeOrderingService({ repo: inMemoryOrderRepo(), events: new InMemoryEventBus() });
  await runWithContext(ctx, async () => {
    await expect(svc.openTable({ outletId: asOutletId(ctx.outletId) })).rejects.toThrow(/tableLabel is required/);

    const parcel = await svc.openTable({
      outletId: asOutletId(ctx.outletId),
      channel: "parcel",
      customerName: "Afrid",
    });
    expect(parcel.tableLabel).toBeNull();
    expect(parcel.channel).toBe("parcel");
  });
});

test("kot done: fire puts a kot in the pending list, bump clears it", async () => {
  const svc = makeOrderingService({ repo: inMemoryOrderRepo(), events: new InMemoryEventBus() });
  await runWithContext(ctx, async () => {
    const o = await svc.openTable({ outletId: asOutletId(ctx.outletId), tableLabel: "T-9" });
    await svc.addItems({ orderId: o.id, lines: [{ ...sampleLine, note: "no onion" }] });
    const fired = await svc.fireKot({ orderId: o.id });

    const kot = fired.kots[0]!;
    expect(kot.number).toBe(1);

    const pending = await svc.listPendingKots(ctx.outletId);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.lines).toEqual([{ itemName: "Masala Dosa", qty: 2, note: "no onion" }]);

    const done = await svc.kotDone({ kotId: kot.id });
    expect(done.doneAt).not.toBeNull();
    expect(await svc.listPendingKots(ctx.outletId)).toHaveLength(0);

    // idempotent — a double-tap on the kitchen screen must not throw
    expect((await svc.kotDone({ kotId: kot.id })).doneAt).toBe(done.doneAt);
  });
});

test("a fired table can order again, and only the new lines are re-fired", async () => {
  const svc = makeOrderingService({ repo: inMemoryOrderRepo(), events: new InMemoryEventBus() });
  await runWithContext(ctx, async () => {
    const o = await svc.openTable({ outletId: asOutletId(ctx.outletId), tableLabel: "T-1" });
    await svc.addItems({ orderId: o.id, lines: [sampleLine] });
    const fired = await svc.fireKot({ orderId: o.id });
    expect(fired.kots[0]!.lineIds).toHaveLength(1);

    // The customer asks for one more thing after the kitchen already started.
    const more = await svc.addItems({
      orderId: o.id,
      lines: [{ ...sampleLine, itemName: "Filter Coffee", qty: 1 }],
    });
    expect(more.state).toBe("items_added");
    expect(more.lines).toHaveLength(2);

    const refired = await svc.fireKot({ orderId: o.id });
    expect(refired.kots).toHaveLength(2);
    // Second ticket carries the new line only — the kitchen never cooks twice.
    expect(refired.kots[1]!.lineIds).toEqual([more.lines[1]!.id]);

    const bill = await svc.settle({ orderId: o.id });
    expect(bill.lines).toHaveLength(2);
  });
});
