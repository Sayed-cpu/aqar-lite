import type { Halalas } from "@/lib/money";
import { addMonthsClamped, isLocalDate, type LocalDate } from "./dates";

/**
 * The installment schedule of a contract. Pure: no database, no clock, no
 * React — the same function builds the schedule the server stores and the
 * one a test checks, and it is the only place that does.
 */

export const MAX_INSTALLMENTS = 120;

export type ScheduleTerms = {
  finalPrice: Halalas;
  /** Due on the start date. Zero means no down payment row. */
  downPayment: Halalas;
  /** Monthly installments after the down payment. */
  installmentCount: number;
  startDate: LocalDate;
};

export type ScheduledInstallment = {
  /** 0 is the down payment; 1..n the monthly installments. */
  seq: number;
  dueDate: LocalDate;
  amount: Halalas;
};

export type ScheduleProblem =
  | "final_price_not_positive"
  | "down_payment_negative"
  | "down_payment_not_below_price"
  | "installment_count_out_of_range"
  | "installments_smaller_than_a_halala"
  | "invalid_start_date";

/** What is wrong with the terms, or null when a schedule can be built. */
export function scheduleProblem(terms: ScheduleTerms): ScheduleProblem | null {
  if (terms.finalPrice <= 0n) return "final_price_not_positive";
  if (terms.downPayment < 0n) return "down_payment_negative";
  if (terms.downPayment >= terms.finalPrice) return "down_payment_not_below_price";
  if (!Number.isInteger(terms.installmentCount) || terms.installmentCount < 1 || terms.installmentCount > MAX_INSTALLMENTS) {
    return "installment_count_out_of_range";
  }
  // Every installment must be at least one halala.
  if (terms.finalPrice - terms.downPayment < BigInt(terms.installmentCount)) return "installments_smaller_than_a_halala";
  if (!isLocalDate(terms.startDate)) return "invalid_start_date";
  return null;
}

/**
 * The down payment on the start date, then the rest split over monthly
 * installments, each due on the start date's day k months later (clamped to
 * the end of a shorter month: a contract starting 31 January is due
 * 28/29 February, 31 March, 30 April).
 *
 * The split is exact: the remainder of the division is spread one halala at a
 * time over the first installments, so any two installments differ by at most
 * one halala and the rows always add up to the final price.
 */
export function generateSchedule(terms: ScheduleTerms): ScheduledInstallment[] {
  const problem = scheduleProblem(terms);
  if (problem) throw new RangeError(`cannot build a schedule: ${problem}`);

  const rows: ScheduledInstallment[] = [];
  if (terms.downPayment > 0n) {
    rows.push({ seq: 0, dueDate: terms.startDate, amount: terms.downPayment });
  }

  const remaining = terms.finalPrice - terms.downPayment;
  const count = BigInt(terms.installmentCount);
  const base = remaining / count;
  const extra = remaining % count;

  for (let k = 1; k <= terms.installmentCount; k++) {
    rows.push({
      seq: k,
      dueDate: addMonthsClamped(terms.startDate, k),
      amount: base + (BigInt(k) <= extra ? 1n : 0n),
    });
  }
  return rows;
}

export function totalOf(rows: readonly { amount: Halalas }[]): Halalas {
  return rows.reduce((sum, row) => sum + row.amount, 0n);
}
