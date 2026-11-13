/**
 * Money is a whole number of halalas (1 SAR = 100 halalas) and nothing else:
 * a `bigint` in the database and in code, and a decimal string ("1250000.50")
 * wherever it has to cross a boundary as text — a form field, the audit log,
 * JSON. No step on the way is a float, so no step can round.
 */
export type Halalas = bigint;

const HALALAS_PER_RIYAL = 100n;

// Up to 999,999,999,999.99 SAR — far past any unit price, and far inside the
// database's bigint.
const SAR_PATTERN = /^(\d{1,12})(?:\.(\d{1,2}))?$/;

/** Arabic-Indic and Persian digits as 0–9; everything else untouched. */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
}

/**
 * Accepts what people actually type into an Arabic form: Arabic-Indic or
 * Persian digits, the Arabic decimal separator, and thousands separators.
 */
export function normalizeNumeral(input: string): string {
  return toLatinDigits(input.trim())
    .replace(/٫/g, ".")
    .replace(/[,٬\s]/g, "");
}

/** A non-negative SAR amount with at most two decimals, or null. */
export function parseSar(input: string): Halalas | null {
  const match = SAR_PATTERN.exec(normalizeNumeral(input));
  if (!match) return null;
  const [, riyals = "0", fraction = ""] = match;
  return BigInt(riyals) * HALALAS_PER_RIYAL + BigInt(fraction.padEnd(2, "0"));
}

/** "1250000.50": exact, ungrouped, and parseable again by parseSar. */
export function toSarString(amount: Halalas): string {
  const sign = amount < 0n ? "-" : "";
  const absolute = amount < 0n ? -amount : amount;
  const riyals = absolute / HALALAS_PER_RIYAL;
  const fraction = (absolute % HALALAS_PER_RIYAL).toString().padStart(2, "0");
  return `${sign}${riyals}.${fraction}`;
}

const groupFormatter = new Intl.NumberFormat("ar-SA-u-nu-latn");

/** "1,250,000.50 ر.س" for display. Intl formats the bigint itself, not a float. */
export function formatSar(amount: Halalas): string {
  const sign = amount < 0n ? "-" : "";
  const absolute = amount < 0n ? -amount : amount;
  const riyals = groupFormatter.format(absolute / HALALAS_PER_RIYAL);
  const fraction = (absolute % HALALAS_PER_RIYAL).toString().padStart(2, "0");
  return `${sign}${riyals}.${fraction} ر.س`;
}
