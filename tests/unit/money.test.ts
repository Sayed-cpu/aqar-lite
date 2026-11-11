import { describe, expect, it } from "vitest";
import { formatSar, parseSar, toSarString } from "@/lib/money";

describe("parseSar", () => {
  it.each([
    ["1250000", 125_000_000n],
    ["1250000.5", 125_000_050n],
    ["1250000.05", 125_000_005n],
    ["0.01", 1n],
    ["1,250,000.50", 125_000_050n],
    ["  990000  ", 99_000_000n],
  ])("reads %j as %s halalas", (input, expected) => {
    expect(parseSar(input)).toBe(expected);
  });

  it("reads Arabic-Indic and Persian digits and the Arabic separators", () => {
    expect(parseSar("١٬٢٥٠٬٠٠٠٫٧٥")).toBe(125_000_075n);
    expect(parseSar("۹۹۰۰۰۰")).toBe(99_000_000n);
  });

  it.each(["", "abc", "-5", "1.234", "1e6", ".5", "5.", "1 000.5.0", "0x10", "Infinity", "1234567890123"])(
    "rejects %j",
    (input) => {
      expect(parseSar(input)).toBeNull();
    },
  );

  it("keeps precision a float would lose", () => {
    // 0.1 + 0.2 in floats is 0.30000000000000004; in halalas it is exact.
    expect((parseSar("0.1") ?? 0n) + (parseSar("0.2") ?? 0n)).toBe(parseSar("0.3"));
    expect(parseSar("999999999999.99")).toBe(99_999_999_999_999n);
  });
});

describe("toSarString / formatSar", () => {
  it("round-trips through parseSar", () => {
    for (const amount of [0n, 1n, 10n, 100n, 125_000_050n, 99_999_999_999_999n]) {
      expect(parseSar(toSarString(amount))).toBe(amount);
    }
  });

  it("always shows two decimals", () => {
    expect(toSarString(125_000_000n)).toBe("1250000.00");
    expect(toSarString(5n)).toBe("0.05");
    expect(toSarString(-150n)).toBe("-1.50");
  });

  it("groups thousands for display", () => {
    expect(formatSar(125_000_050n)).toBe("1,250,000.50 ر.س");
    expect(formatSar(99n)).toBe("0.99 ر.س");
  });
});
