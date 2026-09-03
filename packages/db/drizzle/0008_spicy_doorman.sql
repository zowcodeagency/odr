CREATE TABLE "menu_item_soldout" (
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	CONSTRAINT "menu_item_soldout_outlet_id_item_id_pk" PRIMARY KEY("outlet_id","item_id")
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "outlet_id" uuid;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "menu_mode" text DEFAULT 'shared' NOT NULL;--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_tenant_code_unique" UNIQUE("tenant_id","code");--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_id_tenant_unique" UNIQUE("id","tenant_id");--> statement-breakpoint
ALTER TABLE "menu_item_soldout" ADD CONSTRAINT "menu_item_soldout_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_soldout" ADD CONSTRAINT "menu_item_soldout_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_soldout" ADD CONSTRAINT "menu_item_soldout_item_id_menu_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_outlet_tenant_fk" FOREIGN KEY ("outlet_id","tenant_id") REFERENCES "public"."outlets"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_outlet_tenant_fk" FOREIGN KEY ("outlet_id","tenant_id") REFERENCES "public"."outlets"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_outlet_tenant_fk" FOREIGN KEY ("outlet_id","tenant_id") REFERENCES "public"."outlets"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kots" ADD CONSTRAINT "kots_outlet_tenant_fk" FOREIGN KEY ("outlet_id","tenant_id") REFERENCES "public"."outlets"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_outlet_tenant_fk" FOREIGN KEY ("outlet_id","tenant_id") REFERENCES "public"."outlets"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_outlet_tenant_fk" FOREIGN KEY ("outlet_id","tenant_id") REFERENCES "public"."outlets"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_outlet_tenant_fk" FOREIGN KEY ("outlet_id","tenant_id") REFERENCES "public"."outlets"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_soldout" ADD CONSTRAINT "menu_item_soldout_outlet_tenant_fk" FOREIGN KEY ("outlet_id","tenant_id") REFERENCES "public"."outlets"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "memberships" m
SET "outlet_id" = (
  SELECT o."id" FROM "outlets" o
  WHERE o."tenant_id" = m."tenant_id"
  ORDER BY o."created_at" ASC
  LIMIT 1
)
WHERE m."role" NOT IN ('owner', 'manager') AND m."outlet_id" IS NULL;
--> statement-breakpoint
-- Legacy PWA writes pinned every category/item to its outlet_id; shared-mode
-- reads are now `outlet_id IS NULL OR outlet_id = $o`, so a second shared
-- outlet would see an empty menu unless those old rows are un-pinned.
UPDATE "menu_categories" SET "outlet_id" = NULL WHERE "outlet_id" IN (SELECT "id" FROM "outlets" WHERE "menu_mode" = 'shared');
--> statement-breakpoint
UPDATE "menu_items" SET "outlet_id" = NULL WHERE "outlet_id" IN (SELECT "id" FROM "outlets" WHERE "menu_mode" = 'shared');
