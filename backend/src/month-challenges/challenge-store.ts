import { Brackets, EntityManager, IsNull, LessThanOrEqual, Not } from 'typeorm';
import { dayOf, daysBetween, endOfDay } from '../common/date/local-day';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitScheduleVersionEntity } from '../habits/entities/habit-schedule-version.entity';
import { timeOfMinutes } from '../day-bests/day-best-rules';
import {
  challengeTally,
  challengeToday,
  donePercent,
  type ChallengeRun,
  type ChallengeTally,
  type ChallengeToday,
  type ChallengeWindow,
} from './challenge-progress';
import {
  challengeDay,
  challengeStatus,
  challengeWindow,
  isClosed,
  monthEnd,
  monthOf,
} from './challenge-rules';
import type { MonthChallengeResponse } from './month-challenge.dto';
import { MonthChallengeEntity } from './month-challenge.entity';

/**
 * What the Monats-Challenge reads and writes beside its own endpoints:
 * counting a challenge from the Daily's runs, freezing its result, and the
 * running challenge for Heute, the rows' marker, the reminder and the
 * deletion of its Daily. Callers hold the user's lock where they write.
 */

type Counted = { tally: ChallengeTally; today: ChallengeToday };

const NOTHING: Counted = {
  tally: { done: 0, missed: 0, remaining: 0 },
  today: { state: 'none' },
};

/**
 * The Daily's schedule versions and the runs that matter for the window:
 * those of its slots and those resolved in it (weekly targets count by the
 * day they were done).
 */
async function loadRuns(
  manager: EntityManager,
  habitId: number,
  window: ChallengeWindow,
): Promise<{ versions: HabitScheduleVersionEntity[]; runs: ChallengeRun[] }> {
  const [versions, runs] = await Promise.all([
    manager.getRepository(HabitScheduleVersionEntity).find({
      where: { habitId },
      order: { effectiveAt: 'ASC', id: 'ASC' },
    }),
    manager
      .getRepository(HabitOccurrenceEntity)
      .createQueryBuilder('occurrence')
      .select([
        'occurrence.id',
        'occurrence.scheduleVersionId',
        'occurrence.scheduledDate',
        'occurrence.movedToDate',
        'occurrence.status',
        'occurrence.resolvedDate',
      ])
      .where('"occurrence"."habitId" = :habitId', { habitId })
      .andWhere(
        new Brackets((query) =>
          query
            .where('"occurrence"."scheduledDate" BETWEEN :first AND :last')
            .orWhere('"occurrence"."resolvedDate" BETWEEN :first AND :last'),
        ),
        window,
      )
      .getMany(),
  ]);
  return { versions, runs };
}

/**
 * The tally of a challenge as of `now`, and today's run. Reads the pause
 * from `challenge.habit`, so callers load it; without it no run is open.
 */
export async function countChallenge(
  manager: EntityManager,
  challenge: MonthChallengeEntity,
  now: Date,
): Promise<Counted> {
  if (challenge.habitId === null) return NOTHING;
  const window = challengeWindow(challenge);
  const { versions, runs } = await loadRuns(manager, challenge.habitId, window);
  return {
    tally: challengeTally(versions, runs, window, now),
    today: challengeToday(versions, runs, window, now, {
      isActive: challenge.habit?.isActive === true,
    }),
  };
}

/** Whether the challenge is closed by `now` and its result not fixed yet. */
export function awaitsFreeze(
  challenge: MonthChallengeEntity,
  now: Date,
): boolean {
  return challenge.dueCount === null && isClosed(challenge, dayOf(now));
}

/**
 * Fixes the result of a closed challenge once: done runs against the due
 * runs that were decided. Runs still open when it was ended early do not
 * count either way. Returns whether it wrote.
 */
export async function freezeIfClosed(
  manager: EntityManager,
  challenge: MonthChallengeEntity,
  now: Date,
): Promise<boolean> {
  if (!awaitsFreeze(challenge, now)) return false;
  const { tally } = await countChallenge(
    manager,
    challenge,
    challenge.endedAt ?? now,
  );
  challenge.doneCount = tally.done;
  challenge.dueCount = tally.done + tally.missed;
  await manager.update(MonthChallengeEntity, challenge.id, {
    doneCount: challenge.doneCount,
    dueCount: challenge.dueCount,
  });
  return true;
}

/** What the API shows of a challenge; `counted` for one still open. */
export function challengeResponse(
  challenge: MonthChallengeEntity,
  today: string,
  counted: Counted = NOTHING,
): MonthChallengeResponse {
  const status = challengeStatus(challenge, today);
  const closed = challenge.dueCount !== null;
  const tally: ChallengeTally = closed
    ? {
        done: challenge.doneCount ?? 0,
        missed: challenge.dueCount! - (challenge.doneCount ?? 0),
        remaining: 0,
      }
    : counted.tally;
  const total = tally.done + tally.missed + tally.remaining;
  const endDate = monthEnd(challenge.month);
  const running = status === 'running';
  return {
    id: challenge.id,
    month: challenge.month.slice(0, 7),
    startDate: challenge.startDate,
    endDate,
    habitId: challenge.habitId,
    title: challenge.habit?.title ?? challenge.title,
    reminderTime:
      challenge.reminderMinutes === null
        ? null
        : timeOfMinutes(challenge.reminderMinutes),
    status,
    endedAt: challenge.endedAt?.toISOString() ?? null,
    day: running
      ? challengeDay({ first: challenge.startDate, last: endDate }, today)
      : null,
    days: daysBetween(challenge.startDate, endDate) + 1,
    ...tally,
    total,
    percent: donePercent(tally.done, total),
    todayRun: running ? counted.today.state : 'none',
    todayOccurrenceId:
      running && counted.today.state === 'open'
        ? counted.today.occurrenceId
        : null,
  };
}

/** The challenge running today: this month's, begun, not ended, its Daily there. */
export function findRunningChallenge(
  manager: EntityManager,
  userId: string,
  today: string,
): Promise<MonthChallengeEntity | null> {
  return manager.getRepository(MonthChallengeEntity).findOne({
    where: {
      userId,
      month: monthOf(today),
      startDate: LessThanOrEqual(today),
      endedAt: IsNull(),
      habitId: Not(IsNull()),
    },
    relations: { habit: true },
  });
}

/**
 * The running challenge with its progress as of `now`, for Heute. The
 * caller has brought the Daily's runs up to `now` (the day planner does).
 */
export async function runningChallengeResponse(
  manager: EntityManager,
  userId: string,
  now: Date,
): Promise<MonthChallengeResponse | null> {
  const today = dayOf(now);
  const challenge = await findRunningChallenge(manager, userId, today);
  if (!challenge) return null;
  return challengeResponse(
    challenge,
    today,
    await countChallenge(manager, challenge, now),
  );
}

/** The Dailies carrying the running challenge (at most one), for the marker. */
export async function challengeHabitIds(
  manager: EntityManager,
  userId: string,
  today: string,
): Promise<Set<number>> {
  const running = await findRunningChallenge(manager, userId, today);
  return new Set(running?.habitId ? [running.habitId] : []);
}

/**
 * Where the challenge of `day`'s month stood at the end of that day (now,
 * when it is today): the runs done of those decided by then. For the
 * Wochenrückblick; null without a challenge begun by then or with its Daily
 * deleted.
 */
export async function challengeAsOf(
  manager: EntityManager,
  userId: string,
  day: string,
  now: Date,
): Promise<{ title: string; done: number; due: number } | null> {
  const challenge = await manager.getRepository(MonthChallengeEntity).findOne({
    where: { userId, month: monthOf(day) },
    relations: { habit: true },
  });
  if (!challenge || challenge.habitId === null || challenge.startDate > day)
    return null;
  const window = challengeWindow(challenge);
  if (day < window.last) window.last = day;
  const at = day < dayOf(now) ? endOfDay(day) : now;
  const { versions, runs } = await loadRuns(manager, challenge.habitId, window);
  const { done, missed } = challengeTally(versions, runs, window, at);
  return {
    title: challenge.habit?.title ?? challenge.title,
    done,
    due: done + missed,
  };
}

/**
 * A Daily is deleted: its challenges stay in the history under its title,
 * a running one ends now with its result frozen; one not begun yet goes.
 */
export async function closeChallengesOfHabit(
  manager: EntityManager,
  habit: { id: number; userId: string; title: string },
  now: Date,
): Promise<void> {
  const repository = manager.getRepository(MonthChallengeEntity);
  const today = dayOf(now);
  for (const challenge of await repository.findBy({
    userId: habit.userId,
    habitId: habit.id,
  })) {
    if (!challenge.endedAt && today < challenge.startDate) {
      await repository.delete(challenge.id);
      continue;
    }
    if (!isClosed(challenge, today)) challenge.endedAt = now;
    await freezeIfClosed(manager, challenge, now);
    await repository.update(challenge.id, {
      endedAt: challenge.endedAt,
      title: habit.title,
      habitId: null,
    });
  }
}
