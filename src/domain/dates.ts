/**
 * Calendar dates with no time and no zone, as "YYYY-MM-DD". A due date is a
 * day on a calendar, not an instant: kept as text it cannot drift by a day
 * when it crosses a time zone, and two of them compare as strings.
 */
export type LocalDate = string;

/** The business runs on Riyadh's calendar: "today" and "overdue" are its days. */
export const APP_TIME_ZONE = "Asia/Riyadh";

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type Parts = { year: number; month: number; day: number };

/** The parts of a real calendar date, or null ("2026-02-30" is null). */
export function parseLocalDate(value: string): Parts | null {
  const match = PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2999 || month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isLocalDate(value: string): boolean {
  return parseLocalDate(value) !== null;
}

/** month is 1–12. Day 0 of the next month is the last day of this one. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function format({ year, month, day }: Parts): LocalDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function partsOf(date: LocalDate): Parts {
  const parts = parseLocalDate(date);
  if (!parts) throw new RangeError(`not a calendar date: ${date}`);
  return parts;
}

/**
 * The same day `months` later, or the last day of that month when it is
 * shorter: 2026-01-31 + 1 → 2026-02-28, + 2 → 2026-03-31. Always counted from
 * the date given, never chained, so one short month does not pull every later
 * date back to the 28th.
 */
export function addMonthsClamped(date: LocalDate, months: number): LocalDate {
  const { year, month, day } = partsOf(date);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  return format({ year: targetYear, month: targetMonth, day: Math.min(day, daysInMonth(targetYear, targetMonth)) });
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const { year, month, day } = partsOf(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return format({ year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() });
}

// en-CA formats as YYYY-MM-DD.
const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar date at `now` in a time zone. */
export function todayIn(timeZone: string = APP_TIME_ZONE, now: Date = new Date()): LocalDate {
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFormatters.set(timeZone, formatter);
  }
  return formatter.format(now);
}
