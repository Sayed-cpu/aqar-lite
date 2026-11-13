import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { allocatePayment, remainingOf } from "@/domain/payments";
import { formatSar, toSarString } from "@/lib/money";
import type { RecordPaymentInput } from "@/lib/schemas/sales";
import { DomainError } from "../actions/errors";
import type { ActionContext } from "../actions/create-action";
import { appendAudit } from "../audit/audit.service";
import { loadSchedule } from "../contracts/contracts.service";
import type { Tx } from "../db/client";
import { violatedUniqueConstraint } from "../db/errors";
import { contracts, paymentAllocations, payments, units } from "../db/schema";

export type RecordedPayment = { id: string; contractId: string; replayed: boolean };

const ALREADY_SENT = "هذا النموذج أُرسل من قبل بمبلغ مختلف. حدّث الصفحة وأعد إدخال الدفعة.";

/**
 * An accountant records money received, in one transaction: the payment,
 * how it was spread over the schedule, and the audit entry.
 *
 * The contract's row lock puts payments on one contract in a line, so two at
 * once cannot both read the same balance and together overpay it. Under that
 * lock, a form already submitted (same idempotency key) returns the payment
 * it recorded the first time instead of recording another.
 */
export async function recordPayment(input: RecordPaymentInput, ctx: ActionContext, tx: Tx): Promise<RecordedPayment> {
  const [contract] = await tx
    .select({
      status: contracts.status,
      unitLabel: sql<string>`${units.project} || ' / ' || ${units.number}`,
    })
    .from(contracts)
    .innerJoin(units, eq(units.id, contracts.unitId))
    .where(and(eq(contracts.id, input.contractId), eq(contracts.companyId, ctx.companyId)))
    .for("update", { of: contracts });
  if (!contract) throw new DomainError("NOT_FOUND", "العقد غير موجود");

  const [earlier] = await tx
    .select({ id: payments.id, contractId: payments.contractId, amount: payments.amountHalalas })
    .from(payments)
    .where(and(eq(payments.companyId, ctx.companyId), eq(payments.idempotencyKey, input.idempotencyKey)));
  if (earlier) {
    if (earlier.contractId === input.contractId && earlier.amount === input.amount) {
      return { id: earlier.id, contractId: earlier.contractId, replayed: true };
    }
    throw new DomainError("CONFLICT", ALREADY_SENT);
  }

  if (contract.status !== "approved") {
    throw new DomainError("INVALID_STATE", "تُسجَّل الدفعات على العقود المعتمدة فقط");
  }

  const schedule = await loadSchedule(tx, input.contractId);
  const allocation = allocatePayment(schedule, input.amount);
  if (!allocation.ok) {
    const message =
      allocation.remaining === 0n
        ? "العقد مسدَّد بالكامل"
        : `المبلغ أكبر من المتبقي على العقد (${formatSar(allocation.remaining)})`;
    throw new DomainError("VALIDATION", message, { amount: [message] });
  }

  let paymentId: string;
  try {
    const [created] = await tx
      .insert(payments)
      .values({
        companyId: ctx.companyId,
        contractId: input.contractId,
        amountHalalas: input.amount,
        idempotencyKey: input.idempotencyKey,
        recordedBy: ctx.userId,
      })
      .returning({ id: payments.id });
    if (!created) throw new Error("payment insert returned nothing");
    paymentId = created.id;
  } catch (err) {
    // The same key at the same moment on another contract: the lock above
    // only lines up payments on one contract.
    if (violatedUniqueConstraint(err) === "payments_idempotency_key") throw new DomainError("CONFLICT", ALREADY_SENT);
    throw err;
  }

  // A trigger adds each allocation to its installment's paid amount; a check
  // there refuses more than the installment owes.
  await tx.insert(paymentAllocations).values(
    allocation.allocations.map((part) => ({
      paymentId,
      installmentId: part.installmentId,
      contractId: input.contractId,
      companyId: ctx.companyId,
      amountHalalas: part.amount,
    })),
  );

  await appendAudit(tx, {
    companyId: ctx.companyId,
    actorUserId: ctx.userId,
    action: "payment.recorded",
    entityType: "payment",
    entityId: paymentId,
    metadata: {
      unit: contract.unitLabel,
      amount: toSarString(input.amount),
      remaining: toSarString(remainingOf(schedule) - input.amount),
    },
    ip: ctx.ip,
  });

  return { id: paymentId, contractId: input.contractId, replayed: false };
}
