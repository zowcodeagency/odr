import { Hono } from "hono";
import { z } from "zod";
import { ValidationError } from "@odr/shared";
import type { MenuService } from "./service.ts";

const createCategorySchema = z.object({
  name: z.string().min(1),
  outletId: z.string().uuid().optional(),
  sortOrder: z.number().int().optional(),
});

/** Client downscales before upload; 400k base64 chars ≈ 300KB image. */
const imageSchema = z.object({
  data: z.string().min(1).max(400_000).regex(/^[A-Za-z0-9+/]+=*$/, "image data must be base64"),
  type: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

const createItemSchema = z.object({
  categoryId: z.string().uuid(),
  outletId: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  basePrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "basePrice must be a decimal string"),
  taxClass: z.string().min(1),
  isVeg: z.boolean(),
  image: imageSchema.nullish(),
});

const price = z.string().regex(/^\d+(\.\d{1,2})?$/, "basePrice must be a decimal string");

/** Every field optional — a sold-out toggle sends only isActive. */
const patchItemSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().nullable(),
    basePrice: price,
    taxClass: z.string().min(1),
    isVeg: z.boolean(),
    isActive: z.boolean(),
    image: imageSchema.nullable(),
  })
  .partial()
  .refine((p) => Object.keys(p).length > 0, "nothing to update");

const patchCategorySchema = z
  .object({ name: z.string().min(1), sortOrder: z.number().int() })
  .partial()
  .refine((p) => Object.keys(p).length > 0, "nothing to update");

const parse = <S extends z.ZodTypeAny>(s: S, body: unknown): z.infer<S> => {
  const r = s.safeParse(body);
  if (!r.success) throw new ValidationError("invalid payload", { issues: r.error.issues });
  return r.data;
};

export const buildMenuRoutes = (svc: MenuService) => {
  const r = new Hono();

  // GET /menu/categories?outletId=<id>
  // - outletId provided → master ∪ outlet overrides (what a captain on that outlet sees)
  // - outletId omitted  → every category (admin view)
  r.get("/categories", async (c) => {
    const outletId = c.req.query("outletId") ?? undefined;
    return c.json({ categories: await svc.listCategories(outletId) });
  });

  r.post("/categories", async (c) => {
    const body = parse(createCategorySchema, await c.req.json());
    return c.json({ category: await svc.createCategory(body) }, 201);
  });

  r.get("/items", async (c) => {
    const categoryId = c.req.query("categoryId") ?? undefined;
    const outletId = c.req.query("outletId") ?? undefined;
    return c.json({ items: await svc.listItems({ categoryId, outletId }) });
  });

  r.post("/items", async (c) => {
    const body = parse(createItemSchema, await c.req.json());
    return c.json({ item: await svc.createItem(body) }, 201);
  });

  r.patch("/items/:id", async (c) => {
    const body = parse(patchItemSchema, await c.req.json());
    return c.json({ item: await svc.updateItem(c.req.param("id"), body) });
  });

  const soldoutSchema = z.object({ outletId: z.string().uuid(), soldOut: z.boolean() });

  // PUT /menu/items/:id/soldout — the daily 86, scoped to one outlet.
  r.put("/items/:id/soldout", async (c) => {
    const body = parse(soldoutSchema, await c.req.json());
    return c.json({ item: await svc.setSoldOut(c.req.param("id"), body.outletId, body.soldOut) });
  });

  r.delete("/items/:id", async (c) => {
    await svc.deleteItem(c.req.param("id"));
    return c.body(null, 204);
  });

  r.patch("/categories/:id", async (c) => {
    const body = parse(patchCategorySchema, await c.req.json());
    return c.json({ category: await svc.updateCategory(c.req.param("id"), body) });
  });

  r.delete("/categories/:id", async (c) => {
    await svc.deleteCategory(c.req.param("id"));
    return c.body(null, 204);
  });

  return r;
};
