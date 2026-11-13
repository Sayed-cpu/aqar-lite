// Gregorian calendar and Latin digits, in Riyadh time, whatever the server's
// own timezone is. The month is spelled out — "13 نوفمبر 2026" — because
// 13/11/2026 and 11/13/2026 are both plausible to someone reading quickly.
const dateTimeFormatter = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  timeZone: "Asia/Riyadh",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "13 نوفمبر 2026 في 5:37 م" */
export function formatDateTime(value: Date): string {
  return dateTimeFormatter.format(value);
}

const dateFormatter = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** A calendar date ("YYYY-MM-DD"), shown as the same day wherever it is read. */
export function formatLocalDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

/** How long until a moment, in hours and minutes; "انتهت" once it has passed. */
export function formatTimeLeft(until: Date, now: Date = new Date()): string {
  const minutes = Math.floor((until.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return "انتهت";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} دقيقة`;
  return rest === 0 ? `${hours} ساعة` : `${hours} ساعة و${rest} دقيقة`;
}
