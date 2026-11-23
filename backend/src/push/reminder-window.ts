import { atWallClockMinutes, endOfDay } from '../common/date/local-day';

/**
 * When a daily reminder push is due on Berlin's wall clock, shared by the
 * evening reminder of "Das Beste des Tages" and the one of the
 * Monats-Challenge.
 */

const MINUTES_PER_DAY = 24 * 60;

export type ReminderWindow = { dueAt: Date; expiresAt: Date };

/**
 * The reminder of `date` at `minutes` after midnight, on Berlin's wall
 * clock (so it moves with daylight saving; a time inside the spring gap
 * moves forward, 02:30 → 03:30), and until when it is still worth sending:
 * `windowMinutes` later, never past the end of the day. A time outside the
 * day has no reminder.
 */
export function reminderWindowAt(
  date: string,
  minutes: number,
  windowMinutes: number,
): ReminderWindow | null {
  if (minutes < 0 || minutes >= MINUTES_PER_DAY) return null;
  const dueAt = atWallClockMinutes(date, minutes);
  const latest = dueAt.getTime() + windowMinutes * 60_000;
  const expiresAt = new Date(Math.min(latest, endOfDay(date).getTime()));
  return { dueAt, expiresAt };
}
