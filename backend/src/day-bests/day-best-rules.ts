import { BadRequestException } from '@nestjs/common';
import { assertDateOnly } from '../common/date/date-only.utils';
import { dayOf, daysBetween } from '../common/date/local-day';
import { reminderWindowAt, type ReminderWindow } from '../push/reminder-window';

/**
 * The rules of "Das Beste des Tages" that need no database: what a line is,
 * which days take one, which ranges can be read, and when the evening
 * reminder is due.
 */

/** At most this many days per range read (a year and a bit of paging). */
export const MAX_RANGE_DAYS = 400;
/** The reminder comes this long after the card appears in Heute. */
export const REMINDER_DELAY_MINUTES = 60;
/** After this long without being sent (server down), a reminder is dropped. */
export const REMINDER_WINDOW_MINUTES = 60;

/** One line: whitespace collapsed to single spaces, trimmed. */
export function normalizeDayBestText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Past days and today take a line; tomorrow has not happened yet. */
export function assertWritableDay(date: string, today: string): void {
  assertDateOnly(date);
  if (date > today)
    throw new BadRequestException(
      'Das Beste des Tages gibt es nur für heute und vergangene Tage.',
    );
}

/** A range to read: real days, in order, at most MAX_RANGE_DAYS long. */
export function assertRange(from: string, to: string): void {
  assertDateOnly(from);
  assertDateOnly(to);
  if (from > to)
    throw new BadRequestException('Der Anfang muss vor dem Ende liegen.');
  if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS)
    throw new BadRequestException(
      `Höchstens ${MAX_RANGE_DAYS} Tage auf einmal.`,
    );
}

/** "20:00" → 1200. */
export function minutesOfTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** 1200 → "20:00". */
export function timeOfMinutes(minutes: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export type { ReminderWindow };

/**
 * When the evening reminder for `date` is due (an hour after the card time,
 * on Berlin's wall clock, so it moves with daylight saving) and until when
 * it is still worth sending: an hour later, never past the end of the day.
 * A reminder that would fall on the next day does not exist (card time from
 * 23:00 on); a time inside the spring gap moves forward (02:30 → 03:30).
 */
export function reminderWindow(
  date: string,
  cardMinutes: number,
): ReminderWindow | null {
  return reminderWindowAt(
    date,
    cardMinutes + REMINDER_DELAY_MINUTES,
    REMINDER_WINDOW_MINUTES,
  );
}

export type ReminderState = {
  cardMinutes: number;
  reminderEnabled: boolean;
  /** The Berlin day the reminder was last handled. */
  remindedOn: string | null;
  /** Today already has a line. */
  hasEntry: boolean;
};

/**
 * What to do about today's reminder at `now`:
 * - `none`: switched off, already handled today, today has its line, or the
 *   card time leaves no room for one before midnight;
 * - `wait`: not due yet;
 * - `send`: due, with the window to deliver it in;
 * - `missed`: its window passed unsent (the server was down); it is marked
 *   handled and not caught up.
 */
export type ReminderDecision =
  | { kind: 'none'; day: string }
  | { kind: 'wait'; day: string }
  | { kind: 'missed'; day: string }
  | { kind: 'send'; day: string; dueAt: Date; expiresAt: Date };

export function reminderDecision(
  now: Date,
  state: ReminderState,
): ReminderDecision {
  const day = dayOf(now);
  if (!state.reminderEnabled || state.remindedOn === day || state.hasEntry)
    return { kind: 'none', day };
  const window = reminderWindow(day, state.cardMinutes);
  if (!window) return { kind: 'none', day };
  if (now < window.dueAt) return { kind: 'wait', day };
  if (now >= window.expiresAt) return { kind: 'missed', day };
  return { kind: 'send', day, ...window };
}
