/**
 * Calendar days and wall-clock times of the app, always in Europe/Berlin
 * (same rules as the backend's local-day module), independent of the device.
 */
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

function wallClockParts(instant: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
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

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

/** ISO instant → value for <input type="datetime-local"> in Berlin time. */
export function toLocalInput(isoDateTime: string): string {
  const p = wallClockParts(new Date(isoDateTime));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** <input type="datetime-local"> value read as Berlin wall time → ISO instant, or null if invalid. */
export function fromLocalInput(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  if (new Date(target).getUTCDate() !== day) return null;
  // Converge on the UTC instant whose Berlin wall clock equals the input.
  let candidate = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const p = wallClockParts(new Date(candidate));
    const shown = Date.UTC(
      +p.year,
      +p.month - 1,
      +p.day,
      +p.hour,
      +p.minute,
    );
    if (shown === target) return new Date(candidate).toISOString();
    candidate -= shown - target;
  }
  // Non-existent time in the spring DST gap: take the shifted instant.
  return new Date(candidate).toISOString();
}
