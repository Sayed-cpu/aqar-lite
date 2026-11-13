// Gregorian calendar and Latin digits, in Riyadh time, whatever the server's
// own timezone is.
const dateTimeFormatter = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  timeZone: "Asia/Riyadh",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(value: Date): string {
  return dateTimeFormatter.format(value);
}

const dateFormatter = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  timeZone: "UTC",
  dateStyle: "medium",
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
