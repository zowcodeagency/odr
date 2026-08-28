CREATE TABLE "topups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"amount_minor" numeric(20, 0) NOT NULL,
	"months_added" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "subscription_start" date;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "subscription_end" date;--> statement-breakpoint
ALTER TABLE "topups" ADD CONSTRAINT "topups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "topups_tenant_idx" ON "topups" USING btree ("tenant_id");