CREATE TABLE "bill_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"item_name" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_price_minor" numeric(20, 0) NOT NULL,
	"tax_class" text NOT NULL,
	"line_subtotal_minor" numeric(20, 0) NOT NULL,
	"line_tax_minor" numeric(20, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"fiscal_year" text NOT NULL,
	"currency" text NOT NULL,
	"subtotal_minor" numeric(20, 0) NOT NULL,
	"tax_total_minor" numeric(20, 0) NOT NULL,
	"grand_total_minor" numeric(20, 0) NOT NULL,
	"tax_breakdown" jsonb NOT NULL,
	"settled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bill_lines_bill_idx" ON "bill_lines" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "bills_tenant_idx" ON "bills" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "bills_order_idx" ON "bills" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bills_invoice_unique" ON "bills" USING btree ("outlet_id","fiscal_year","invoice_number");