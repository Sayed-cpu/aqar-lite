import "server-only";
import { and, asc, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { isAllowedFinalPrice, minimumFinalPrice } from "@/domain/contracts";
import type { LocalDate } from "@/domain/dates";
import { generateSchedule, scheduleProblem } from "@/domain/installments";
import { remainingOf } from "@/domain/payments";
import { formatSar, type Halalas, toSarString } from "@/lib/money";
import type { ContractStatus } from "@/lib/sales";
import type {
  ApproveContractInput,
  ContractDraftInput,
  ContractListQuery,
  ContractTerms,
  ContractUpdateInput,
} from "@/lib/schemas/sales";
import { DomainError } from "../actions/errors";
import type { ActionContext } from "../actions/create-action";
import { appendAudit } from "../audit/audit.service";
import type { Tx } from "../db/client";
import { violatedUniqueConstraint } from "../db/errors";
import { offsetOf, type Page, pageOf } from "../db/page";
import { clients, contracts, installments, paymentAllocations, payments, reservations, units, users } from "../db/schema";
import { type TenantCtx, withTenant } from "../db/tenant";

export type ContractListItem = {
  id: string;
  status: ContractStatus;
  unitLabel: string;
  clientName: string;
  repName: string;
  finalPrice: Halalas;
  paid: Halalas;
  /** A draft can only be approved while this is true. */
  reservationLive: boolean;
  createdAt: Date;
};

export type InstallmentRow = { id: string; seq: number; dueDate: LocalDate; amount: Halalas; paid: Halalas };

export type PaymentRow = {
  id: string;
  amount: Halalas;
  createdAt: Date;
  recorderName: string;
  allocations: { seq: number; amount: Halalas }[];
};

export type ContractDetail = {
  id: string;
  status: ContractStatus;
  revision: number;
  listPrice: Halalas;
  finalPrice: Halalas;
  downPayment: Halalas;
  installmentCount: number;
  startDate: LocalDate;
  createdAt: Date;
  approvedAt: Date | null;
  approverName: string | null;
  unitId: string;
  unitLabel: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  salesRepId: string;
  repName: string;
  reservationId: string;
  reservationExpiresAt: Date;
  reservationLive: boolean;
  installments: InstallmentRow[];
  payments: PaymentRow[];
  paid: Halalas;
  remaining: Halalas;
};

const approver = alias(users, "approver");
const recorder = alias(users, "recorder");

const unitLabel = sql<string>`${units.project} || ' / ' || ${units.number}`;
const reservationLive = sql<boolean>`${reservations.status} = 'active' and ${reservations.expiresAt} > now()`;

/** A rep sees their own contracts; the manager and accountant, the company's. */
function visibleTo(ctx: TenantCtx): SQL {
  const inCompany = eq(contracts.companyId, ctx.companyId);
  return ctx.role === "sales_rep" ? (and(inCompany, eq(contracts.salesRepId, ctx.userId)) as SQL) : inCompany;
}

export function listContracts(ctx: TenantCtx, query: ContractListQuery): Promise<Page<ContractListItem>> {
  return withTenant(ctx, async (tx) => {
    const where = and(visibleTo(ctx), query.status ? eq(contracts.status, query.status) : undefined);

    const [counted] = await tx.select({ total: sql<number>`count(*)::int` }).from(contracts).where(where);
    const items = await tx
      .select({
        id: contracts.id,
        status: contracts.status,
        unitLabel,
        clientName: clients.name,
        repName: users.name,
        finalPrice: contracts.finalPriceHalalas,
        paid: sql<bigint>`coalesce((select sum(i.paid_halalas) from installments i where i.contract_id = ${contracts.id}), 0)`.mapWith(
          BigInt,
        ),
        reservationLive,
        createdAt: contracts.createdAt,
      })
      .from(contracts)
      .innerJoin(units, eq(units.id, contracts.unitId))
      .innerJoin(clients, eq(clients.id, contracts.clientId))
      .innerJoin(users, eq(users.id, contracts.salesRepId))
      .innerJoin(reservations, eq(reservations.id, contracts.reservationId))
      .where(where)
      .orderBy(desc(contracts.createdAt), desc(contracts.id))
      .limit(query.pageSize)
      .offset(offsetOf(query));

    return pageOf(items, counted?.total ?? 0, query);
  });
}

/** Null for an id that does not exist, is another company's, or another rep's. */
export function getContract(ctx: TenantCtx, id: string): Promise<ContractDetail | null> {
  return withTenant(ctx, async (tx) => {
    const [contract] = await tx
      .select({
        id: contracts.id,
        status: contracts.status,
        revision: contracts.revision,
        listPrice: contracts.listPriceHalalas,
        finalPrice: contracts.finalPriceHalalas,
        downPayment: contracts.downPaymentHalalas,
        installmentCount: contracts.installmentCount,
        startDate: contracts.startDate,
        createdAt: contracts.createdAt,
        approvedAt: contracts.approvedAt,
        approverName: approver.name,
        unitId: contracts.unitId,
        unitLabel,
        clientId: contracts.clientId,
        clientName: clients.name,
        clientPhone: clients.phone,
        salesRepId: contracts.salesRepId,
        repName: users.name,
        reservationId: contracts.reservationId,
        reservationExpiresAt: reservations.expiresAt,
        reservationLive,
      })
      .from(contracts)
      .innerJoin(units, eq(units.id, contracts.unitId))
      .innerJoin(clients, eq(clients.id, contracts.clientId))
      .innerJoin(users, eq(users.id, contracts.salesRepId))
      .innerJoin(reservations, eq(reservations.id, contracts.reservationId))
      .leftJoin(approver, eq(approver.id, contracts.approvedBy))
      .where(and(visibleTo(ctx), eq(contracts.id, id)));
    if (!contract) return null;

    const schedule = await loadSchedule(tx, id);

    const paymentRows = await tx
      .select({
        id: payments.id,
        amount: payments.amountHalalas,
        createdAt: payments.createdAt,
        recorderName: recorder.name,
      })
      .from(payments)
      .innerJoin(recorder, eq(recorder.id, payments.recordedBy))
      .where(eq(payments.contractId, id))
      .orderBy(desc(payments.createdAt), desc(payments.id));

    const allocations = paymentRows.length
      ? await tx
          .select({
            paymentId: paymentAllocations.paymentId,
            seq: installments.seq,
            amount: paymentAllocations.amountHalalas,
          })
          .from(paymentAllocations)
          .innerJoin(installments, eq(installments.id, paymentAllocations.installmentId))
          .where(
            inArray(
              paymentAllocations.paymentId,
              paymentRows.map((row) => row.id),
            ),
          )
          .orderBy(asc(installments.seq))
      : [];

    const remaining = remainingOf(schedule);
    return {
      ...contract,
      installments: schedule,
      payments: paymentRows.map((payment) => ({
        ...payment,
        allocations: allocations
          .filter((allocation) => allocation.paymentId === payment.id)
          .map(({ seq, amount }) => ({ seq, amount })),
      })),
      paid: contract.finalPrice - remaining,
      remaining,
    };
  });
}

export function loadSchedule(tx: Tx, contractId: string): Promise<InstallmentRow[]> {
  return tx
    .select({
      id: installments.id,
      seq: installments.seq,
      dueDate: installments.dueDate,
      amount: installments.amountHalalas,
      paid: installments.paidHalalas,
    })
    .from(installments)
    .where(eq(installments.contractId, contractId))
    .orderBy(asc(installments.dueDate), asc(installments.seq));
}

const RESERVATION_ENDED = "انتهت مدة الحجز (72 ساعة) فعادت الوحدة متاحة. يلزم حجز جديد.";
const APPROVED_IS_FINAL = "العقد معتمد ولا يمكن تعديله";

/**
 * The terms against the unit's list price. Every refusal is placed on the
 * field it is about, so the form shows it there.
 */
function checkTerms(listPrice: Halalas, terms: ContractTerms): void {
  if (!isAllowedFinalPrice(listPrice, terms.finalPrice)) {
    const message = `السعر النهائي بين ${formatSar(minimumFinalPrice(listPrice))} و${formatSar(listPrice)} (خصم 5% على الأكثر)`;
    throw new DomainError("VALIDATION", message, { finalPrice: [message] });
  }
  const problem = scheduleProblem({ ...terms });
  if (problem === "installments_smaller_than_a_halala") {
    const message = "عدد الأقساط أكبر من المبلغ المتبقي بالهللة";
    throw new DomainError("VALIDATION", message, { installmentCount: [message] });
  }
  if (problem === "down_payment_not_below_price" || problem === "down_payment_negative") {
    const message = "الدفعة الأولى يجب أن تكون أقل من السعر النهائي";
    throw new DomainError("VALIDATION", message, { downPayment: [message] });
  }
  if (problem) throw new DomainError("VALIDATION", "تحقق من شروط العقد");
}

async function writeSchedule(tx: Tx, ctx: ActionContext, contractId: string, terms: ContractTerms): Promise<void> {
  await tx.insert(installments).values(
    generateSchedule(terms).map((row) => ({
      companyId: ctx.companyId,
      contractId,
      seq: row.seq,
      dueDate: row.dueDate,
      amountHalalas: row.amount,
    })),
  );
}

/** The unit's lock first (the lock order every path follows), then the reservation's state. */
async function lockUnitAndReadReservation(tx: Tx, unitId: string, reservationId: string) {
  await tx.select({ id: units.id }).from(units).where(eq(units.id, unitId)).for("update");
  const [reservation] = await tx
    .select({ live: reservationLive, priceHalalas: units.priceHalalas })
    .from(reservations)
    .innerJoin(units, eq(units.id, reservations.unitId))
    .where(eq(reservations.id, reservationId));
  return reservation;
}

/** A rep turns one of their active reservations into a draft contract. */
export async function createDraft(input: ContractDraftInput, ctx: ActionContext, tx: Tx): Promise<{ id: string }> {
  const [reservation] = await tx
    .select({ unitId: reservations.unitId, clientId: reservations.clientId })
    .from(reservations)
    .where(
      and(
        eq(reservations.id, input.reservationId),
        eq(reservations.companyId, ctx.companyId),
        eq(reservations.reservedBy, ctx.userId),
      ),
    );
  if (!reservation) throw new DomainError("NOT_FOUND", "الحجز غير موجود");

  const current = await lockUnitAndReadReservation(tx, reservation.unitId, input.reservationId);
  if (!current?.live) throw new DomainError("INVALID_STATE", RESERVATION_ENDED);

  const listPrice = current.priceHalalas;
  checkTerms(listPrice, input);

  try {
    const [created] = await tx
      .insert(contracts)
      .values({
        companyId: ctx.companyId,
        reservationId: input.reservationId,
        unitId: reservation.unitId,
        clientId: reservation.clientId,
        salesRepId: ctx.userId,
        listPriceHalalas: listPrice,
        finalPriceHalalas: input.finalPrice,
        downPaymentHalalas: input.downPayment,
        installmentCount: input.installmentCount,
        startDate: input.startDate,
      })
      .returning({ id: contracts.id });
    if (!created) throw new Error("contract insert returned nothing");
    await writeSchedule(tx, ctx, created.id, input);
    return created;
  } catch (err) {
    if (violatedUniqueConstraint(err) === "contracts_one_per_reservation") {
      throw new DomainError("CONFLICT", "يوجد عقد لهذا الحجز بالفعل");
    }
    throw err;
  }
}

/** A rep changes the terms of their own draft; the schedule is rebuilt from them. */
export async function updateDraft(input: ContractUpdateInput, ctx: ActionContext, tx: Tx): Promise<{ id: string }> {
  const [contract] = await tx
    .select({ unitId: contracts.unitId, reservationId: contracts.reservationId, status: contracts.status })
    .from(contracts)
    .where(and(eq(contracts.id, input.id), eq(contracts.companyId, ctx.companyId), eq(contracts.salesRepId, ctx.userId)));
  if (!contract) throw new DomainError("NOT_FOUND", "العقد غير موجود");
  if (contract.status !== "draft") throw new DomainError("INVALID_STATE", APPROVED_IS_FINAL);

  const reservation = await lockUnitAndReadReservation(tx, contract.unitId, contract.reservationId);
  // The rep's update policy covers drafts only, so a contract approved a
  // moment ago is simply not returned here.
  const [locked] = await tx
    .select({ status: contracts.status, listPrice: contracts.listPriceHalalas })
    .from(contracts)
    .where(eq(contracts.id, input.id))
    .for("update");
  if (locked?.status !== "draft") throw new DomainError("INVALID_STATE", APPROVED_IS_FINAL);
  if (!reservation?.live) throw new DomainError("INVALID_STATE", RESERVATION_ENDED);

  checkTerms(locked.listPrice, input);

  await tx
    .update(contracts)
    .set({
      finalPriceHalalas: input.finalPrice,
      downPaymentHalalas: input.downPayment,
      installmentCount: input.installmentCount,
      startDate: input.startDate,
    })
    .where(eq(contracts.id, input.id));
  await tx.delete(installments).where(eq(installments.contractId, input.id));
  await writeSchedule(tx, ctx, input.id, input);
  return { id: input.id };
}

/**
 * An accountant approves a draft, in one transaction: the contract becomes
 * approved, its reservation converted, its unit sold, and the approval is in
 * the audit log — all of it or none of it.
 */
export async function approveContract(input: ApproveContractInput, ctx: ActionContext, tx: Tx): Promise<{ id: string }> {
  const [contract] = await tx
    .select({ unitId: contracts.unitId, reservationId: contracts.reservationId })
    .from(contracts)
    .where(and(eq(contracts.id, input.id), eq(contracts.companyId, ctx.companyId)));
  if (!contract) throw new DomainError("NOT_FOUND", "العقد غير موجود");

  // Unit, then reservation, then contract: the order every path locks in.
  await tx.select({ id: units.id }).from(units).where(eq(units.id, contract.unitId)).for("update");
  const [reservation] = await tx
    .select({ live: reservationLive })
    .from(reservations)
    .where(eq(reservations.id, contract.reservationId))
    .for("update");
  const [locked] = await tx
    .select({
      status: contracts.status,
      revision: contracts.revision,
      finalPrice: contracts.finalPriceHalalas,
      unitLabel,
      clientName: clients.name,
    })
    .from(contracts)
    .innerJoin(units, eq(units.id, contracts.unitId))
    .innerJoin(clients, eq(clients.id, contracts.clientId))
    .where(eq(contracts.id, input.id))
    .for("update", { of: contracts });
  if (!locked || !reservation) throw new DomainError("NOT_FOUND", "العقد غير موجود");

  if (locked.status === "approved") throw new DomainError("INVALID_STATE", "العقد معتمد بالفعل");
  if (locked.revision !== input.revision) {
    throw new DomainError("CONFLICT", "عدّل المندوب المسودة بعد أن فتحت الصفحة. راجع الشروط الحالية ثم اعتمد.");
  }
  if (!reservation.live) throw new DomainError("INVALID_STATE", RESERVATION_ENDED);

  await tx.update(contracts).set({ status: "approved", approvedBy: ctx.userId }).where(eq(contracts.id, input.id));
  await tx
    .update(reservations)
    .set({ status: "converted", endedAt: sql`now()` })
    .where(eq(reservations.id, contract.reservationId));
  await tx.update(units).set({ status: "sold" }).where(eq(units.id, contract.unitId));

  await appendAudit(tx, {
    companyId: ctx.companyId,
    actorUserId: ctx.userId,
    action: "contract.approved",
    entityType: "contract",
    entityId: input.id,
    metadata: { unit: locked.unitLabel, client: locked.clientName, finalPrice: toSarString(locked.finalPrice) },
    ip: ctx.ip,
  });

  return { id: input.id };
}
