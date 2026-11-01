import { BadRequestException } from '@nestjs/common';
import { Weekday } from '../../habits/enums/weekday.enum';
import {
  DEFAULT_TIME_ZONE,
  assertDateOnly,
  getCurrentDateInTimeZone,
  midnightInTimeZone,
} from './date-only.utils';

/**
 * Calendar days of the app ("YYYY-MM-DD" in Europe/Berlin).
 * The single place for day arithmetic, week ranges and instant↔day mapping.
 * Arithmetic runs on UTC noon so it never shifts at daylight-saving changes.
 */
export type DateRange = { startDate: string; endDate: string };

const DAY_MS = 86_400_000;
const WEEKDAYS: Weekday[] = [
  Weekday.SUNDAY,
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
];

function noon(date: string): number {
  const value = Date.parse(`${date}T12:00:00.000Z`);
  if (Number.isNaN(value))
    throw new BadRequestException('Invalid calendar date');
  return value;
}

/** Shifts a day; throws BadRequest outside the four-digit calendar range. */
export function addDays(date: string, days: number): string {
  const result = new Date(noon(date) + days * DAY_MS).toISOString();
  if (!/^\d{4}-\d{2}-\d{2}T/.test(result))
    throw new BadRequestException(
      'Date is outside the supported calendar range',
    );
  return result.slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((noon(to) - noon(from)) / DAY_MS);
}

export function weekdayOf(date: string): Weekday {
  return WEEKDAYS[new Date(noon(date)).getUTCDay()];
}

/** Monday–Sunday week containing `date`; the end is clamped to 9999-12-31. */
export function weekRange(date: string): DateRange {
  const startDate = addDays(
    date,
    -((new Date(noon(date)).getUTCDay() + 6) % 7),
  );
  const endDate =
    startDate > '9999-12-24' ? '9999-12-31' : addDays(startDate, 6);
  return { startDate, endDate };
}

/** The app's calendar day of an instant. */
export function dayOf(instant: Date): string {
  return getCurrentDateInTimeZone(DEFAULT_TIME_ZONE, instant);
}

/** Instant at which `date` starts in the app time zone. */
export function startOfDay(date: string): Date {
  return midnightInTimeZone(date);
}

function wallClockMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: DEFAULT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((item) => item.type === type)!.value);
  return (
    (part('hour') * 3600 + part('minute') * 60 + part('second')) * 1000 +
    instant.getUTCMilliseconds()
  );
}

/**
 * The instant on `date` with the same app-zone wall clock as `instant`.
 * A time inside the spring DST gap moves forward (02:30 → 03:30).
 */
export function atSameWallClock(instant: Date, date: string): Date {
  const target = wallClockMs(instant);
  const first = startOfDay(date).getTime() + target;
  let drift = target - wallClockMs(new Date(first));
  if (drift > DAY_MS / 2) drift -= DAY_MS;
  if (drift < -DAY_MS / 2) drift += DAY_MS;
  const corrected = new Date(first + drift);
  return wallClockMs(corrected) === target ? corrected : new Date(first);
}

/** The instant `minutes` after midnight on the wall clock of `date`. */
export function atWallClockMinutes(date: string, minutes: number): Date {
  // January has no DST change, so the offset from midnight is the wall clock.
  const reference = startOfDay('2026-01-15').getTime() + minutes * 60_000;
  return atSameWallClock(new Date(reference), date);
}

/** The instant of an `HH:MM` time of day on `date`. */
export function atTimeOfDay(date: string, timeOfDay: string): Date {
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  return atWallClockMinutes(date, hours * 60 + minutes);
}

/** Exclusive end instant of `date` (start of the following day). */
export function endOfDay(date: string): Date {
  assertDateOnly(date);
  return midnightInTimeZone(addDays(date, 1));
}
