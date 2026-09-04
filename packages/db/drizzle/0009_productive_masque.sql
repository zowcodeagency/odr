ALTER TABLE "tenants" ADD COLUMN "local_billing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "outlets" ADD COLUMN "upi_id" text;