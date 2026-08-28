/*
 * Tenant branding — the owner's colors, font, logo and theme, stored as one
 * jsonb blob on the tenant row. Every signed-in role reads it (their app is
 * themed too); only the owner writes it.
 *
 * ponytail: one file, no service/repo split — two queries on one column.
 */
import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@odr/db";
import { getContext } from "@odr/tenancy";
import { ForbiddenError, ValidationError } from "@odr/shared";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "expected #rrggbb");

const brandingSchema = z.object({
  primary: hex,
  secondary: hex,
  tertiary: hex.nullable().optional(),
  onPrimary: hex.nullable().optional(),
  font: z.string().min(1).max(64),
  theme: z.enum(["light", "dark", "auto"]),
  style: z.enum(["classic", "gradient", "soft", "sharp", "glass"]).optional(),
  // Logos are downscaled client-side; the cap is a backstop, not the resize.
  logo: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/)
    .max(200_000)
    .nullable()
    .optional(),
});

const ownerOnly = () => {
  if (getContext().role !== "owner") throw new ForbiddenError("owner only");
};

export const buildBrandingRoutes = () => {
  const r = new Hono();

  r.get("/", async (c) => {
    const { tenantId } = getContext();
    const rows = await db
      .select({ branding: schema.tenants.branding })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId))
      .limit(1);
    return c.json({ branding: rows[0]?.branding ?? null });
  });

  r.put("/", async (c) => {
    ownerOnly();
    const parsed = brandingSchema.safeParse(await c.req.json());
    if (!parsed.success) throw new ValidationError("invalid branding", { issues: parsed.error.issues });
    const { tenantId } = getContext();
    await db.update(schema.tenants).set({ branding: parsed.data }).where(eq(schema.tenants.id, tenantId));
    return c.json({ branding: parsed.data });
  });

  r.delete("/", async (c) => {
    ownerOnly();
    const { tenantId } = getContext();
    await db.update(schema.tenants).set({ branding: null }).where(eq(schema.tenants.id, tenantId));
    return c.body(null, 204);
  });

  return r;
};
