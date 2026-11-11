import { describe, expect, it } from "vitest";
import { allocatePayment, type InstallmentBalance, installmentState, remainingOf } from "@/domain/payments";

const schedule = (paid: bigint[] = [0n, 0n, 0n, 0n]): InstallmentBalance[] => [
  { id: "down", seq: 0, dueDate: "2026-01-31", amount: 1_000n, paid: paid[0] ?? 0n },
  { id: "m1", seq: 1, dueDate: "2026-02-28", amount: 3_000n, paid: paid[1] ?? 0n },
  { id: "m2", seq: 2, dueDate: "2026-03-31", amount: 3_000n, paid: paid[2] ?? 0n },
  { id: "m3", seq: 3, dueDate: "2026-04-30", amount: 3_000n, paid: paid[3] ?? 0n },
];

describe("allocatePayment", () => {
  it("fills the oldest installment first and leaves the last one touched partial", () => {
    expect(allocatePayment(schedule(), 2_500n)).toEqual({
      ok: true,
      allocations: [
        { installmentId: "down", amount: 1_000n },
        { installmentId: "m1", amount: 1_500n },
      ],
    });
  });

  it("starts where the previous payments stopped", () => {
    expect(allocatePayment(schedule([1_000n, 1_500n]), 2_000n)).toEqual({
      ok: true,
      allocations: [
        { installmentId: "m1", amount: 1_500n },
        { installmentId: "m2", amount: 500n },
      ],
    });
  });

  it("orders by due date, not by the order the rows arrive in", () => {
    const shuffled = [...schedule()].reverse();
    const result = allocatePayment(shuffled, 1_500n);
    expect(result.ok && result.allocations.map((a) => a.installmentId)).toEqual(["down", "m1"]);
  });

  it("pays a whole contract off exactly", () => {
    const result = allocatePayment(schedule(), 10_000n);
    expect(result.ok && result.allocations.reduce((sum, a) => sum + a.amount, 0n)).toBe(10_000n);
  });

  it("refuses a payment larger than what is left, and says how much is left", () => {
    expect(allocatePayment(schedule([1_000n, 3_000n]), 6_001n)).toEqual({
      ok: false,
      reason: "exceeds_remaining",
      remaining: 6_000n,
    });
  });

  it("refuses zero and negative amounts", () => {
    expect(allocatePayment(schedule(), 0n)).toMatchObject({ ok: false, reason: "not_positive" });
    expect(allocatePayment(schedule(), -5n)).toMatchObject({ ok: false, reason: "not_positive" });
  });

  it("refuses anything on a contract already paid in full", () => {
    const paidUp = schedule([1_000n, 3_000n, 3_000n, 3_000n]);
    expect(remainingOf(paidUp)).toBe(0n);
    expect(allocatePayment(paidUp, 1n)).toMatchObject({ ok: false, reason: "exceeds_remaining", remaining: 0n });
  });

  it("never allocates more than an installment owes, nor more than was paid", () => {
    let rows = schedule();
    for (const amount of [1n, 999n, 1n, 2_999n, 3_000n, 1_500n, 1_500n]) {
      const result = allocatePayment(rows, amount);
      if (!result.ok) throw new Error(result.reason);
      expect(result.allocations.reduce((sum, a) => sum + a.amount, 0n)).toBe(amount);
      rows = rows.map((row) => {
        const applied = result.allocations.find((a) => a.installmentId === row.id)?.amount ?? 0n;
        return { ...row, paid: row.paid + applied };
      });
      expect(rows.every((row) => row.paid <= row.amount)).toBe(true);
    }
    expect(remainingOf(rows)).toBe(0n);
  });
});

describe("installmentState", () => {
  const installment = { amount: 3_000n, dueDate: "2026-02-28" };

  it.each([
    [0n, "2026-02-27", "unpaid"],
    [0n, "2026-02-28", "unpaid"],
    [0n, "2026-03-01", "overdue"],
    [1_000n, "2026-02-01", "partial"],
    [1_000n, "2026-03-01", "overdue"],
    [3_000n, "2026-03-01", "paid"],
  ] as const)("paid %s on %s is %s", (paid, today, state) => {
    expect(installmentState({ ...installment, paid }, today)).toBe(state);
  });
});
