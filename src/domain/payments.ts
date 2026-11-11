import type { Halalas } from "@/lib/money";
import type { LocalDate } from "./dates";

/**
 * How a payment is spread over a contract's installments, and what state each
 * installment is in. Pure, like the schedule: the service loads the rows,
 * these functions decide, the service writes the result.
 */

export type InstallmentBalance = {
  id: string;
  seq: number;
  dueDate: LocalDate;
  amount: Halalas;
  paid: Halalas;
};

export type Allocation = { installmentId: string; amount: Halalas };

export type AllocationResult =
  | { ok: true; allocations: Allocation[] }
  | { ok: false; reason: "not_positive" | "exceeds_remaining"; remaining: Halalas };

export function outstandingOf(installment: Pick<InstallmentBalance, "amount" | "paid">): Halalas {
  return installment.amount - installment.paid;
}

/** What is left to pay on the whole schedule. */
export function remainingOf(installments: readonly Pick<InstallmentBalance, "amount" | "paid">[]): Halalas {
  return installments.reduce((sum, row) => sum + outstandingOf(row), 0n);
}

/** Oldest due date first; the down payment (seq 0) before an installment due the same day. */
function byDueDate(a: InstallmentBalance, b: InstallmentBalance): number {
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  return a.seq - b.seq;
}

/**
 * Fills the oldest unpaid installments first: each takes what it still owes,
 * until the payment is used up. The last one touched may be left partly paid.
 * A payment larger than what the contract still owes is refused whole rather
 * than partly applied.
 */
export function allocatePayment(installments: readonly InstallmentBalance[], amount: Halalas): AllocationResult {
  const remaining = remainingOf(installments);
  if (amount <= 0n) return { ok: false, reason: "not_positive", remaining };
  if (amount > remaining) return { ok: false, reason: "exceeds_remaining", remaining };

  const allocations: Allocation[] = [];
  let left = amount;
  for (const installment of [...installments].sort(byDueDate)) {
    if (left === 0n) break;
    const owed = outstandingOf(installment);
    if (owed <= 0n) continue;
    const applied = owed < left ? owed : left;
    allocations.push({ installmentId: installment.id, amount: applied });
    left -= applied;
  }
  return { ok: true, allocations };
}

export const INSTALLMENT_STATES = ["paid", "partial", "overdue", "unpaid"] as const;
export type InstallmentState = (typeof INSTALLMENT_STATES)[number];

/**
 * paid: nothing owed. overdue: something is still owed and the due date has
 * passed (a partly paid installment is still overdue). partial: some paid,
 * not yet due. unpaid: nothing paid, not yet due. Due today is not overdue.
 */
export function installmentState(
  installment: Pick<InstallmentBalance, "amount" | "paid" | "dueDate">,
  today: LocalDate,
): InstallmentState {
  if (installment.paid >= installment.amount) return "paid";
  if (installment.dueDate < today) return "overdue";
  if (installment.paid > 0n) return "partial";
  return "unpaid";
}
