ALTER TABLE "bills" ADD COLUMN "channel" text DEFAULT 'dine_in' NOT NULL;
--> statement-breakpoint
-- Backfill from the orders that still exist; device-billed orders are gone and stay dine_in.
UPDATE "bills" SET "channel" = o."channel" FROM "orders" o WHERE o."id" = "bills"."order_id";
