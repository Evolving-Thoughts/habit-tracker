import { BadRequestException } from '@nestjs/common';

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

  const year = parts
    .find((part) => part.type === 'year')
    ?.value.padStart(4, '0');

  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(`Could not determine date for ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

export function assertDateOnly(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BadRequestException('Date must use YYYY-MM-DD');
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new BadRequestException('Invalid calendar date');
  }
}

export function midnightInTimeZone(
  date: string,
  timeZone = DEFAULT_TIME_ZONE,
): Date {
  assertDateOnly(date);

  const targetUtc = new Date(`${date}T00:00:00.000Z`).getTime();

  const formatter = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  let candidate = targetUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = formatter.formatToParts(new Date(candidate));

    const value = (type: string): string => {
      const result = parts.find((part) => part.type === type)?.value;

      if (!result) {
        throw new Error(`Missing date part ${type}`);
      }

      return result;
    };

    const representedLocalTime = new Date(
      `${value('year').padStart(4, '0')}-${value('month')}-${value('day')}` +
        `T${value('hour')}:${value('minute')}:${value('second')}.000Z`,
    ).getTime();

    const difference = representedLocalTime - targetUtc;

    if (difference === 0) {
      return new Date(candidate);
    }

    candidate -= difference;
  }

  throw new BadRequestException(
    `Could not determine midnight for ${date} in ${timeZone}`,
  );
}

export function initialScheduleInstant(startDate: string, now: Date): Date {
  assertDateOnly(startDate);

  return startDate === getCurrentDateInTimeZone(DEFAULT_TIME_ZONE, now)
    ? new Date(now)
    : midnightInTimeZone(startDate);
}

export function changeScheduleInstant(
  effectiveFrom: string | undefined,
  now: Date,
): Date {
  const today = getCurrentDateInTimeZone(DEFAULT_TIME_ZONE, now);

  if (effectiveFrom === undefined || effectiveFrom === today) {
    return new Date(now);
  }

  assertDateOnly(effectiveFrom);

  if (effectiveFrom < today) {
    throw new BadRequestException('effectiveFrom cannot be in the past');
  }

  return midnightInTimeZone(effectiveFrom);
}
