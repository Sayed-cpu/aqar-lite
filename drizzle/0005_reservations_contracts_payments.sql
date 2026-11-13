ALTER TABLE "clients" ADD CONSTRAINT "clients_id_owner_company_key" UNIQUE("id","owner_user_id","company_id");--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('draft', 'approved');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('active', 'expired', 'converted');--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"sales_rep_id" uuid NOT NULL,
	"status" "contract_status" DEFAULT 'draft' NOT NULL,
	"list_price_halalas" bigint NOT NULL,
	"final_price_halalas" bigint NOT NULL,
	"down_payment_halalas" bigint NOT NULL,
	"installment_count" smallint NOT NULL,
	"start_date" date NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contracts_one_per_reservation" UNIQUE("reservation_id"),
	CONSTRAINT "contracts_id_company_id_key" UNIQUE("id","company_id"),
	CONSTRAINT "contracts_list_price_positive" CHECK ("contracts"."list_price_halalas" > 0),
	CONSTRAINT "contracts_final_price_positive" CHECK ("contracts"."final_price_halalas" > 0),
	CONSTRAINT "contracts_final_price_not_above_list" CHECK ("contracts"."final_price_halalas" <= "contracts"."list_price_halalas"),
	CONSTRAINT "contracts_discount_at_most_5_percent" CHECK ("contracts"."final_price_halalas" * 100 >= "contracts"."list_price_halalas" * 95),
	CONSTRAINT "contracts_down_payment_range" CHECK ("contracts"."down_payment_halalas" >= 0 and "contracts"."down_payment_halalas" < "contracts"."final_price_halalas"),
	CONSTRAINT "contracts_installment_count_range" CHECK ("contracts"."installment_count" between 1 and 120),
	CONSTRAINT "contracts_installments_at_least_a_halala" CHECK ("contracts"."final_price_halalas" - "contracts"."down_payment_halalas" >= "contracts"."installment_count"),
	CONSTRAINT "contracts_approval_recorded" CHECK (("contracts"."status" = 'draft' and "contracts"."approved_by" is null and "contracts"."approved_at" is null)
        or ("contracts"."status" = 'approved' and "contracts"."approved_by" is not null and "contracts"."approved_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"seq" smallint NOT NULL,
	"due_date" date NOT NULL,
	"amount_halalas" bigint NOT NULL,
	"paid_halalas" bigint DEFAULT 0 NOT NULL,
	"payment_status" text GENERATED ALWAYS AS (case when paid_halalas = 0 then 'unpaid' when paid_halalas < amount_halalas then 'partial' else 'paid' end) STORED NOT NULL,
	CONSTRAINT "installments_contract_seq_key" UNIQUE("contract_id","seq"),
	CONSTRAINT "installments_allocation_target_key" UNIQUE("id","contract_id","company_id"),
	CONSTRAINT "installments_seq_range" CHECK ("installments"."seq" between 0 and 120),
	CONSTRAINT "installments_amount_positive" CHECK ("installments"."amount_halalas" > 0),
	CONSTRAINT "installments_paid_within_amount" CHECK ("installments"."paid_halalas" >= 0 and "installments"."paid_halalas" <= "installments"."amount_halalas")
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"payment_id" uuid NOT NULL,
	"installment_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"amount_halalas" bigint NOT NULL,
	CONSTRAINT "payment_allocations_pkey" PRIMARY KEY("payment_id","installment_id"),
	CONSTRAINT "payment_allocations_amount_positive" CHECK ("payment_allocations"."amount_halalas" > 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"amount_halalas" bigint NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_idempotency_key" UNIQUE("company_id","idempotency_key"),
	CONSTRAINT "payments_allocation_target_key" UNIQUE("id","contract_id","company_id"),
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_halalas" > 0)
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"reserved_by" uuid NOT NULL,
	"status" "reservation_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "reservations_contract_target_key" UNIQUE("id","unit_id","client_id","reserved_by","company_id"),
	CONSTRAINT "reservations_lasts_72_hours" CHECK ("reservations"."expires_at" = "reservations"."created_at" + interval '72 hours'),
	CONSTRAINT "reservations_ended_iff_not_active" CHECK (("reservations"."status" = 'active') = ("reservations"."ended_at" is null))
);
--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_matches_reservation_fk" FOREIGN KEY ("reservation_id","unit_id","client_id","sales_rep_id","company_id") REFERENCES "public"."reservations"("id","unit_id","client_id","reserved_by","company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_approver_same_company_fk" FOREIGN KEY ("approved_by","company_id") REFERENCES "public"."users"("id","company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_contract_same_company_fk" FOREIGN KEY ("contract_id","company_id") REFERENCES "public"."contracts"("id","company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_fk" FOREIGN KEY ("payment_id","contract_id","company_id") REFERENCES "public"."payments"("id","contract_id","company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_installment_fk" FOREIGN KEY ("installment_id","contract_id","company_id") REFERENCES "public"."installments"("id","contract_id","company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_contract_same_company_fk" FOREIGN KEY ("contract_id","company_id") REFERENCES "public"."contracts"("id","company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorder_same_company_fk" FOREIGN KEY ("recorded_by","company_id") REFERENCES "public"."users"("id","company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_unit_same_company_fk" FOREIGN KEY ("unit_id","company_id") REFERENCES "public"."units"("id","company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_client_of_rep_fk" FOREIGN KEY ("client_id","reserved_by","company_id") REFERENCES "public"."clients"("id","owner_user_id","company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_rep_same_company_fk" FOREIGN KEY ("reserved_by","company_id") REFERENCES "public"."users"("id","company_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_one_approved_per_unit" ON "contracts" USING btree ("unit_id") WHERE "contracts"."status" = 'approved';--> statement-breakpoint
CREATE INDEX "contracts_company_created_at_idx" ON "contracts" USING btree ("company_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "contracts_company_rep_created_at_idx" ON "contracts" USING btree ("company_id","sales_rep_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "installments_contract_due_date_idx" ON "installments" USING btree ("contract_id","due_date","seq");--> statement-breakpoint
CREATE INDEX "payment_allocations_installment_idx" ON "payment_allocations" USING btree ("installment_id");--> statement-breakpoint
CREATE INDEX "payments_contract_created_at_idx" ON "payments" USING btree ("contract_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_one_active_per_unit" ON "reservations" USING btree ("unit_id") WHERE "reservations"."status" = 'active';--> statement-breakpoint
CREATE INDEX "reservations_company_created_at_idx" ON "reservations" USING btree ("company_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reservations_company_rep_created_at_idx" ON "reservations" USING btree ("company_id","reserved_by","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reservations_active_expires_at_idx" ON "reservations" USING btree ("expires_at") WHERE "reservations"."status" = 'active';
