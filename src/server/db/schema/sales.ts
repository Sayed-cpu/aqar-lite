import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { companies, users } from "./auth";
import { clients, units } from "./catalog";
import { contractStatus, reservationStatus } from "./enums";

// Every row carries its company, and every reference is a composite foreign
// key that includes it: a row can only point at rows of its own company, and
// the database checks that, not the code.

const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();

/**
 * A rep holding a unit for one of their clients, for 72 hours. At most one
 * active reservation per unit; it ends as expired (time ran out) or converted
 * (its contract was approved and the unit sold).
 */
export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    unitId: uuid("unit_id").notNull(),
    clientId: uuid("client_id").notNull(),
    reservedBy: uuid("reserved_by").notNull(),
    status: reservationStatus("status").notNull().default("active"),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    foreignKey({
      name: "reservations_unit_same_company_fk",
      columns: [t.unitId, t.companyId],
      foreignColumns: [units.id, units.companyId],
    }).onDelete("restrict"),
    // The client is the reserving rep's own, in the same company.
    foreignKey({
      name: "reservations_client_of_rep_fk",
      columns: [t.clientId, t.reservedBy, t.companyId],
      foreignColumns: [clients.id, clients.ownerUserId, clients.companyId],
    }).onDelete("restrict"),
    foreignKey({
      name: "reservations_rep_same_company_fk",
      columns: [t.reservedBy, t.companyId],
      foreignColumns: [users.id, users.companyId],
    }).onDelete("restrict"),
    // The last word on two reps reserving one unit at the same instant.
    uniqueIndex("reservations_one_active_per_unit").on(t.unitId).where(sql`${t.status} = 'active'`),
    // Target for contracts: a contract repeats its reservation's unit, client and rep.
    unique("reservations_contract_target_key").on(t.id, t.unitId, t.clientId, t.reservedBy, t.companyId),
    index("reservations_company_created_at_idx").on(t.companyId, t.createdAt.desc()),
    index("reservations_company_rep_created_at_idx").on(t.companyId, t.reservedBy, t.createdAt.desc()),
    index("reservations_active_expires_at_idx").on(t.expiresAt).where(sql`${t.status} = 'active'`),
    check("reservations_lasts_72_hours", sql`${t.expiresAt} = ${t.createdAt} + interval '72 hours'`),
    check("reservations_ended_iff_not_active", sql`(${t.status} = 'active') = (${t.endedAt} is null)`),
  ],
);

/**
 * A rep's draft, approved once by an accountant and never changed after.
 * The unit, client and rep are those of the reservation it came from; the
 * list price is the unit's price when the draft was made (it cannot change
 * while the unit is reserved).
 */
export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    reservationId: uuid("reservation_id").notNull(),
    unitId: uuid("unit_id").notNull(),
    clientId: uuid("client_id").notNull(),
    salesRepId: uuid("sales_rep_id").notNull(),
    status: contractStatus("status").notNull().default("draft"),
    listPriceHalalas: bigint("list_price_halalas", { mode: "bigint" }).notNull(),
    finalPriceHalalas: bigint("final_price_halalas", { mode: "bigint" }).notNull(),
    downPaymentHalalas: bigint("down_payment_halalas", { mode: "bigint" }).notNull(),
    installmentCount: smallint("installment_count").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    // Bumped by a trigger whenever the terms of a draft change, so an
    // approval can say which version of the draft it approves.
    revision: integer("revision").notNull().default(1),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "contracts_matches_reservation_fk",
      columns: [t.reservationId, t.unitId, t.clientId, t.salesRepId, t.companyId],
      foreignColumns: [
        reservations.id,
        reservations.unitId,
        reservations.clientId,
        reservations.reservedBy,
        reservations.companyId,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "contracts_approver_same_company_fk",
      columns: [t.approvedBy, t.companyId],
      foreignColumns: [users.id, users.companyId],
    }).onDelete("restrict"),
    unique("contracts_one_per_reservation").on(t.reservationId),
    // A unit is sold once.
    uniqueIndex("contracts_one_approved_per_unit").on(t.unitId).where(sql`${t.status} = 'approved'`),
    unique("contracts_id_company_id_key").on(t.id, t.companyId),
    index("contracts_company_created_at_idx").on(t.companyId, t.createdAt.desc()),
    index("contracts_company_rep_created_at_idx").on(t.companyId, t.salesRepId, t.createdAt.desc()),
    check("contracts_list_price_positive", sql`${t.listPriceHalalas} > 0`),
    check("contracts_final_price_positive", sql`${t.finalPriceHalalas} > 0`),
    // At most a 5% discount, and never above the list price. Whole numbers only.
    check("contracts_final_price_not_above_list", sql`${t.finalPriceHalalas} <= ${t.listPriceHalalas}`),
    check(
      "contracts_discount_at_most_5_percent",
      sql`${t.finalPriceHalalas} * 100 >= ${t.listPriceHalalas} * 95`,
    ),
    check(
      "contracts_down_payment_range",
      sql`${t.downPaymentHalalas} >= 0 and ${t.downPaymentHalalas} < ${t.finalPriceHalalas}`,
    ),
    check("contracts_installment_count_range", sql`${t.installmentCount} between 1 and 120`),
    // A one-halala minimum per installment.
    check(
      "contracts_installments_at_least_a_halala",
      sql`${t.finalPriceHalalas} - ${t.downPaymentHalalas} >= ${t.installmentCount}`,
    ),
    check(
      "contracts_approval_recorded",
      sql`(${t.status} = 'draft' and ${t.approvedBy} is null and ${t.approvedAt} is null)
        or (${t.status} = 'approved' and ${t.approvedBy} is not null and ${t.approvedAt} is not null)`,
    ),
  ],
);

/**
 * A contract's schedule: the down payment (seq 0) and the monthly
 * installments. paid_amount only ever grows, and only through a payment
 * allocation (a trigger adds it); the app cannot UPDATE this table at all.
 */
export const installments = pgTable(
  "installments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    contractId: uuid("contract_id").notNull(),
    seq: smallint("seq").notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    amountHalalas: bigint("amount_halalas", { mode: "bigint" }).notNull(),
    paidHalalas: bigint("paid_halalas", { mode: "bigint" }).notNull().default(sql`0`),
    // Stored so it can be queried and read in psql. "Overdue" depends on
    // today's date, so it cannot be stored; it is derived where it is read.
    paymentStatus: text("payment_status")
      .notNull()
      .generatedAlwaysAs(
        sql`case when paid_halalas = 0 then 'unpaid' when paid_halalas < amount_halalas then 'partial' else 'paid' end`,
      ),
  },
  (t) => [
    foreignKey({
      name: "installments_contract_same_company_fk",
      columns: [t.contractId, t.companyId],
      foreignColumns: [contracts.id, contracts.companyId],
    }).onDelete("restrict"),
    unique("installments_contract_seq_key").on(t.contractId, t.seq),
    // Target for allocations: an installment of the payment's own contract.
    unique("installments_allocation_target_key").on(t.id, t.contractId, t.companyId),
    index("installments_contract_due_date_idx").on(t.contractId, t.dueDate, t.seq),
    check("installments_seq_range", sql`${t.seq} between 0 and 120`),
    check("installments_amount_positive", sql`${t.amountHalalas} > 0`),
    check("installments_paid_within_amount", sql`${t.paidHalalas} >= 0 and ${t.paidHalalas} <= ${t.amountHalalas}`),
  ],
);

/**
 * Money received against a contract. Never updated, never deleted. The
 * idempotency key comes from the form that recorded it, so the same form
 * submitted twice (a double click, a retried request) records one payment.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    contractId: uuid("contract_id").notNull(),
    amountHalalas: bigint("amount_halalas", { mode: "bigint" }).notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    recordedBy: uuid("recorded_by").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "payments_contract_same_company_fk",
      columns: [t.contractId, t.companyId],
      foreignColumns: [contracts.id, contracts.companyId],
    }).onDelete("restrict"),
    foreignKey({
      name: "payments_recorder_same_company_fk",
      columns: [t.recordedBy, t.companyId],
      foreignColumns: [users.id, users.companyId],
    }).onDelete("restrict"),
    unique("payments_idempotency_key").on(t.companyId, t.idempotencyKey),
    unique("payments_allocation_target_key").on(t.id, t.contractId, t.companyId),
    index("payments_contract_created_at_idx").on(t.contractId, t.createdAt),
    check("payments_amount_positive", sql`${t.amountHalalas} > 0`),
  ],
);

/** Which installments a payment paid, and how much of each. Append-only. */
export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    paymentId: uuid("payment_id").notNull(),
    installmentId: uuid("installment_id").notNull(),
    contractId: uuid("contract_id").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    amountHalalas: bigint("amount_halalas", { mode: "bigint" }).notNull(),
  },
  (t) => [
    primaryKey({ name: "payment_allocations_pkey", columns: [t.paymentId, t.installmentId] }),
    // Payment and installment belong to the same contract of the same company.
    foreignKey({
      name: "payment_allocations_payment_fk",
      columns: [t.paymentId, t.contractId, t.companyId],
      foreignColumns: [payments.id, payments.contractId, payments.companyId],
    }).onDelete("restrict"),
    foreignKey({
      name: "payment_allocations_installment_fk",
      columns: [t.installmentId, t.contractId, t.companyId],
      foreignColumns: [installments.id, installments.contractId, installments.companyId],
    }).onDelete("restrict"),
    index("payment_allocations_installment_idx").on(t.installmentId),
    check("payment_allocations_amount_positive", sql`${t.amountHalalas} > 0`),
  ],
);
