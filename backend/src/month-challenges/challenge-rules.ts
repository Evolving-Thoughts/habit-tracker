import { BadRequestException } from '@nestjs/common';
import { addDays, dayOf, daysBetween } from '../common/date/local-day';
import { reminderWindowAt } from '../push/reminder-window';
import type { ChallengeWindow } from './challenge-progress';

/**
 * The rules of a Monats-Challenge around its counting: its month and days,
 * its state, and when its daily reminder is due (docs/challenges.md).
 */

/** After this long without being sent (server down), a reminder is dropped. */
export const CHALLENGE_REMINDER_WINDOW_MINUTES = 60;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The first day of the month of `day`. */
export function monthOf(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

/** The first day of the month after the one starting on `month`. */
export function nextMonth(month: string): string {
  return monthOf(addDays(month, 31));
}

/** The last day of the month starting on `month`. */
export function monthEnd(month: string): string {
  return addDays(nextMonth(month), -1);
}

/** "2026-11" → "2026-11-01"; anything else is refused. */
export function monthFromKey(key: string): string {
  if (!MONTH_PATTERN.test(key))
    throw new BadRequestException('Der Monat muss als JJJJ-MM kommen.');
  return `${key}-01`;
}

/** A challenge is for this month or, to prepare it, for the next one. */
export function assertChallengeMonth(month: string, today: string): void {
  const current = monthOf(today);
  if (month !== current && month !== nextMonth(current))
    throw new BadRequestException(
      'Eine Monats-Challenge gibt es nur für diesen oder den nächsten Monat.',
    );
}

/** Where a challenge begins counting: today in the running month, else the month's first. */
export function startDateFor(month: string, today: string): string {
  return month === monthOf(today) ? today : month;
}

export type ChallengeStatus =
  'upcoming' | 'running' | 'succeeded' | 'finished' | 'ended';

type ChallengeDates = {
  month: string;
  startDate: string;
  endedAt: Date | null;
};

/**
 * The days a challenge counts: from its start to the month's end; one
 * ended early counts up to the day it ended.
 */
export function challengeWindow(challenge: ChallengeDates): ChallengeWindow {
  const last = monthEnd(challenge.month);
  const ended = challenge.endedAt ? dayOf(challenge.endedAt) : null;
  return {
    first: challenge.startDate,
    last: ended !== null && ended < last ? ended : last,
  };
}

/**
 * Whether a challenge is still to come, running, or closed: ended early,
 * or the month is over and then done only at 100 % of its due runs.
 */
export function challengeStatus(
  challenge: ChallengeDates & {
    doneCount: number | null;
    dueCount: number | null;
  },
  today: string,
): ChallengeStatus {
  if (challenge.endedAt) return 'ended';
  if (today < challenge.startDate) return 'upcoming';
  if (today <= monthEnd(challenge.month)) return 'running';
  return challenge.dueCount !== null &&
    challenge.dueCount > 0 &&
    challenge.doneCount === challenge.dueCount
    ? 'succeeded'
    : 'finished';
}

/** Whether the result is fixed: the month is over or it was ended. */
export function isClosed(challenge: ChallengeDates, today: string): boolean {
  return challenge.endedAt !== null || today > monthEnd(challenge.month);
}

/** The challenge's day of today, 1 on its first day; null outside its days. */
export function challengeDay(
  window: ChallengeWindow,
  today: string,
): number | null {
  return today < window.first || today > window.last
    ? null
    : daysBetween(window.first, today) + 1;
}

export type ChallengeReminderState = {
  /** Minutes after midnight (Berlin); null when the reminder is off. */
  reminderMinutes: number | null;
  /** The Berlin day the reminder was last handled. */
  remindedOn: string | null;
  /** Today is a day of the challenge, which runs and still has its Daily. */
  running: boolean;
  /** Today's run is due and still open. */
  runOpen: boolean;
};

/**
 * What to do about today's reminder at `now`:
 * - `none`: off, already handled today, or the challenge does not run today;
 * - `wait`: not due yet;
 * - `settled`: due, but today's run is done, skipped or not due today: it
 *   is marked handled without a push;
 * - `send`: due and the run is open, with the window to deliver it in;
 * - `missed`: its window passed unsent (the server was down); it is marked
 *   handled and not caught up.
 */
export type ChallengeReminderDecision =
  | { kind: 'none'; day: string }
  | { kind: 'wait'; day: string }
  | { kind: 'settled'; day: string }
  | { kind: 'missed'; day: string }
  | { kind: 'send'; day: string; dueAt: Date; expiresAt: Date };

export function challengeReminderDecision(
  now: Date,
  state: ChallengeReminderState,
): ChallengeReminderDecision {
  const day = dayOf(now);
  if (
    state.reminderMinutes === null ||
    state.remindedOn === day ||
    !state.running
  )
    return { kind: 'none', day };
  const window = reminderWindowAt(
    day,
    state.reminderMinutes,
    CHALLENGE_REMINDER_WINDOW_MINUTES,
  );
  if (!window) return { kind: 'none', day };
  if (now < window.dueAt) return { kind: 'wait', day };
  if (now >= window.expiresAt) return { kind: 'missed', day };
  if (!state.runOpen) return { kind: 'settled', day };
  return { kind: 'send', day, ...window };
}
