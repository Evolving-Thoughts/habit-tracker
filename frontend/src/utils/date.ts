export const APP_TIME_ZONE = "Europe/Berlin";

export function formatDateForGermanDisplay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");

  if (!year || !month || !day) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }

  return `${day}.${month}.${year}`;
}

export function formatTimeForGermanDisplay(isoDateTime: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDateTime));
}

export function getCurrentDateInTimeZone(
  timeZone = APP_TIME_ZONE,
  now = new Date(),
): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
