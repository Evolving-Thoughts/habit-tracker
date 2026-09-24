export const DEFAULT_TIME_ZONE = 'Europe/Berlin';

export function getCurrentDateInTimeZone(
  timeZone = DEFAULT_TIME_ZONE,
  now = new Date(),
): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((part) => part.type === 'year')?.value;

  const month = parts.find((part) => part.type === 'month')?.value;

  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(
      `Could not determine the current date for time zone ${timeZone}`,
    );
  }

  return `${year}-${month}-${day}`;
}
