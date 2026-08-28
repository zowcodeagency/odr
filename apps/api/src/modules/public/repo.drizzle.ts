import { eq } from "drizzle-orm";
import type { DB } from "@odr/db";
import { outlets, orders } from "@odr/db/schema";
import type { PublicRepo } from "./ports.ts";

const cols = {
  id: outlets.id,
  tenantId: outlets.tenantId,
  name: outlets.name,
  publicToken: outlets.publicToken,
};

export const drizzlePublicRepo = (db: DB): PublicRepo => ({
  async outletById(outletId) {
    const [row] = await db.select(cols).from(outlets).where(eq(outlets.id, outletId)).limit(1);
    return row ?? null;
  },

  async outletForOrder(orderId) {
    const [row] = await db
      .select(cols)
      .from(orders)
      .innerJoin(outlets, eq(outlets.id, orders.outletId))
      .where(eq(orders.id, orderId))
      .limit(1);
    return row ?? null;
  },
});
