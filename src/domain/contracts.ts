import type { Halalas } from "@/lib/money";

/**
 * The price a contract may be signed at: the unit's price, or less by at most
 * 5%. Compared in whole numbers (final × 100 ≥ price × 95), the same
 * inequality the contracts table checks, so neither side ever divides.
 */
export const MAX_DISCOUNT_PERCENT = 5n;

export function isAllowedFinalPrice(listPrice: Halalas, finalPrice: Halalas): boolean {
  return finalPrice <= listPrice && finalPrice * 100n >= listPrice * (100n - MAX_DISCOUNT_PERCENT);
}

/** The lowest allowed final price, rounded up to the halala so it is itself allowed. */
export function minimumFinalPrice(listPrice: Halalas): Halalas {
  const scaled = listPrice * (100n - MAX_DISCOUNT_PERCENT);
  return scaled / 100n + (scaled % 100n === 0n ? 0n : 1n);
}
