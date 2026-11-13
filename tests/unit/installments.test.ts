import { describe, expect, it } from "vitest";
import { isAllowedFinalPrice, minimumFinalPrice } from "@/domain/contracts";
import { addDays, addMonthsClamped, isLocalDate, todayIn } from "@/domain/dates";
import { generateSchedule, MAX_INSTALLMENTS, scheduleProblem, totalOf } from "@/domain/installments";

describe("addMonthsClamped", () => {
  it.each([
    ["2026-01-31", 1, "2026-02-28"],
    ["2028-01-31", 1, "2028-02-29"],
    ["2026-01-31", 2, "2026-03-31"],
    ["2026-01-31", 3, "2026-04-30"],
    ["2026-03-31", -1, "2026-02-28"],
    ["2026-11-15", 2, "2027-01-15"],
    ["2026-12-31", 12, "2027-12-31"],
    ["2028-02-29", 12, "2029-02-28"],
  ])("%s + %i months = %s", (start, months, expected) => {
    expect(addMonthsClamped(start, months)).toBe(expected);
  });

  it("counts every month from the start, so February does not pull March back to the 28th", () => {
    const dues = [1, 2, 3, 4].map((k) => addMonthsClamped("2026-01-31", k));
    expect(dues).toEqual(["2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  });
});

describe("dates", () => {
  it.each(["2026-02-30", "2026-13-01", "2026-1-01", "26-01-01", "", "2026-02-29"])("rejects %j", (value) => {
    expect(isLocalDate(value)).toBe(false);
  });

  it("adds days across a month and a year", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("reads today on Riyadh's calendar, not the server's", () => {
    // 22:30 UTC on 31 Jan is already 1 Feb in Riyadh (UTC+3).
    expect(todayIn("Asia/Riyadh", new Date("2026-01-31T22:30:00Z"))).toBe("2026-02-01");
    expect(todayIn("UTC", new Date("2026-01-31T22:30:00Z"))).toBe("2026-01-31");
  });
});

describe("generateSchedule", () => {
  it("puts the down payment on the start date and the installments monthly after it", () => {
    const rows = generateSchedule({
      finalPrice: 100_000_000n,
      downPayment: 10_000_000n,
      installmentCount: 3,
      startDate: "2026-01-31",
    });
    expect(rows).toEqual([
      { seq: 0, dueDate: "2026-01-31", amount: 10_000_000n },
      { seq: 1, dueDate: "2026-02-28", amount: 30_000_000n },
      { seq: 2, dueDate: "2026-03-31", amount: 30_000_000n },
      { seq: 3, dueDate: "2026-04-30", amount: 30_000_000n },
    ]);
  });

  it("spreads an uneven remainder one halala at a time over the first installments", () => {
    // 100 SAR over 3 installments: 33.34 + 33.33 + 33.33.
    const rows = generateSchedule({ finalPrice: 10_000n, downPayment: 0n, installmentCount: 3, startDate: "2026-05-10" });
    expect(rows.map((row) => row.amount)).toEqual([3_334n, 3_333n, 3_333n]);
    expect(totalOf(rows)).toBe(10_000n);
  });

  it("has no down payment row when there is none", () => {
    const rows = generateSchedule({ finalPrice: 1_200n, downPayment: 0n, installmentCount: 12, startDate: "2026-05-10" });
    expect(rows.map((row) => row.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(rows.every((row) => row.amount === 100n)).toBe(true);
  });

  it("adds up to the final price to the halala, for any terms", () => {
    // A fixed-seed generator: the same thousand cases on every run.
    let seed = 20261110;
    const next = (bound: number) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed % bound;
    };
    for (let i = 0; i < 1_000; i++) {
      const finalPrice = BigInt(next(2_000_000_000)) * 7n + BigInt(next(100)) + 1_000n;
      const downPayment = (finalPrice * BigInt(next(90))) / 100n;
      const installmentCount = 1 + next(MAX_INSTALLMENTS);
      const rows = generateSchedule({ finalPrice, downPayment, installmentCount, startDate: "2026-01-31" });

      expect(totalOf(rows)).toBe(finalPrice);
      const monthly = rows.filter((row) => row.seq > 0).map((row) => row.amount);
      expect(monthly).toHaveLength(installmentCount);
      const max = monthly.reduce((a, b) => (a > b ? a : b));
      const min = monthly.reduce((a, b) => (a < b ? a : b));
      expect(max - min <= 1n).toBe(true);
      expect(min > 0n).toBe(true);
    }
  });

  it("keeps a 9-figure price exact, where a float would not", () => {
    // 999,999,999,999.99 SAR over 7 months: a double cannot even hold the halalas.
    const finalPrice = 99_999_999_999_999n;
    const rows = generateSchedule({ finalPrice, downPayment: 1n, installmentCount: 7, startDate: "2026-01-01" });
    expect(totalOf(rows)).toBe(finalPrice);
  });

  // The problem leads each row: Vitest cannot print a bigint in a title.
  it.each([
    ["final_price_not_positive", { finalPrice: 0n }],
    ["down_payment_negative", { downPayment: -1n }],
    ["down_payment_not_below_price", { downPayment: 1_000n }],
    ["installment_count_out_of_range", { installmentCount: 0 }],
    ["installment_count_out_of_range", { installmentCount: MAX_INSTALLMENTS + 1 }],
    ["installment_count_out_of_range", { installmentCount: 2.5 }],
    ["installments_smaller_than_a_halala", { finalPrice: 10n, downPayment: 5n, installmentCount: 6 }],
    ["invalid_start_date", { startDate: "2026-02-30" }],
  ] as const)("refuses terms with %s", (problem, overrides) => {
    const terms = { finalPrice: 1_000n, downPayment: 100n, installmentCount: 3, startDate: "2026-01-01", ...overrides };
    expect(scheduleProblem(terms)).toBe(problem);
    expect(() => generateSchedule(terms)).toThrow(RangeError);
  });
});

describe("the 5% discount limit", () => {
  it("allows the list price and anything down to 95% of it, and nothing outside", () => {
    expect(isAllowedFinalPrice(100_000n, 100_000n)).toBe(true);
    expect(isAllowedFinalPrice(100_000n, 95_000n)).toBe(true);
    expect(isAllowedFinalPrice(100_000n, 94_999n)).toBe(false);
    expect(isAllowedFinalPrice(100_000n, 100_001n)).toBe(false);
  });

  it("rounds the minimum up to a halala that is itself allowed", () => {
    // 95% of 333.33 SAR is 316.6635 SAR: the lowest allowed is 316.67.
    expect(minimumFinalPrice(33_333n)).toBe(31_667n);
    expect(isAllowedFinalPrice(33_333n, 31_667n)).toBe(true);
    expect(isAllowedFinalPrice(33_333n, 31_666n)).toBe(false);
  });
});
