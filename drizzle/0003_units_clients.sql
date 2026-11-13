CREATE TYPE "public"."unit_status" AS ENUM('available', 'reserved', 'sold');--> statement-breakpoint
CREATE TYPE "public"."unit_type" AS ENUM('apartment', 'villa', 'townhouse', 'duplex', 'office', 'shop');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_owner_phone_key" UNIQUE("company_id","owner_user_id","phone"),
	CONSTRAINT "clients_id_company_id_key" UNIQUE("id","company_id"),
	CONSTRAINT "clients_name_not_blank" CHECK (length(trim("clients"."name")) > 0),
	CONSTRAINT "clients_phone_format" CHECK ("clients"."phone" ~ '^\+?[0-9]{8,15}$'),
	CONSTRAINT "clients_notes_length" CHECK (length("clients"."notes") <= 2000)
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project" text NOT NULL,
	"number" text NOT NULL,
	"type" "unit_type" NOT NULL,
	"area_sqm" numeric(8, 2) NOT NULL,
	"rooms" smallint NOT NULL,
	"price_halalas" bigint NOT NULL,
	"status" "unit_status" DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_company_project_number_key" UNIQUE("company_id","project","number"),
	CONSTRAINT "units_id_company_id_key" UNIQUE("id","company_id"),
	CONSTRAINT "units_project_not_blank" CHECK (length(trim("units"."project")) > 0),
	CONSTRAINT "units_number_not_blank" CHECK (length(trim("units"."number")) > 0),
	CONSTRAINT "units_area_positive" CHECK ("units"."area_sqm" > 0),
	CONSTRAINT "units_rooms_range" CHECK ("units"."rooms" between 0 and 50),
	CONSTRAINT "units_price_positive" CHECK ("units"."price_halalas" > 0)
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_owner_same_company_fk" FOREIGN KEY ("owner_user_id","company_id") REFERENCES "public"."users"("id","company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_company_owner_created_at_idx" ON "clients" USING btree ("company_id","owner_user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "units_company_status_price_idx" ON "units" USING btree ("company_id","status","price_halalas");--> statement-breakpoint
CREATE INDEX "units_company_area_idx" ON "units" USING btree ("company_id","area_sqm");--> statement-breakpoint
CREATE INDEX "units_company_created_at_idx" ON "units" USING btree ("company_id","created_at" DESC NULLS LAST);