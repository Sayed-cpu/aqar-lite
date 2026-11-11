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
