import type { EntityManager } from 'typeorm';
import { dayOf } from '../common/date/local-day';
import type { HabitSchedulingService } from '../habits/scheduling/habit-scheduling.service';
import type { ChallengeReminderState } from './challenge-rules';
import { countChallenge, findRunningChallenge } from './challenge-store';
import { MonthChallengeEntity } from './month-challenge.entity';

/**
 * What the push side reads and writes about the daily reminder of the
 * Monats-Challenge, inside its own user lock. The rule itself is
 * `challengeReminderDecision`.
 */

/**
 * Today's reminder state of the person's running challenge, with its Daily
 * brought up to `now` first (so today's run is stored); null without one.
 */
export async function loadChallengeReminder(
  manager: EntityManager,
  scheduling: HabitSchedulingService,
  userId: string,
  now: Date,
): Promise<{ challengeId: number; state: ChallengeReminderState } | null> {
  const challenge = await findRunningChallenge(manager, userId, dayOf(now));
  if (!challenge) return null;
  if (challenge.habit?.isActive)
    await scheduling.openHabit(manager, userId, challenge.habit.id, now);
  const { today } = await countChallenge(manager, challenge, now);
  return {
    challengeId: challenge.id,
    state: {
      reminderMinutes: challenge.reminderMinutes,
      remindedOn: challenge.remindedOn,
      running: true,
      runOpen: today.state === 'open',
    },
  };
}

/** The reminder of `day` is handled: it is not looked at again that day. */
export async function markChallengeReminded(
  manager: EntityManager,
  challengeId: number,
  day: string,
): Promise<void> {
  await manager.update(MonthChallengeEntity, challengeId, { remindedOn: day });
}

/**
 * The Daily's title while a queued reminder for `day` should still show:
 * it is still that day, the challenge runs with its reminder on, and today's
 * run is still open. Null otherwise.
 */
export async function challengeReminderTitle(
  manager: EntityManager,
  userId: string,
  day: string,
  now: Date,
): Promise<string | null> {
  if (dayOf(now) !== day) return null;
  const challenge = await findRunningChallenge(manager, userId, day);
  if (!challenge || challenge.reminderMinutes === null) return null;
  const { today } = await countChallenge(manager, challenge, now);
  return today.state === 'open'
    ? (challenge.habit?.title ?? challenge.title)
    : null;
}
