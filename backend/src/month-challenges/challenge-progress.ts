import {
  addDays,
  dayOf,
  startOfDay,
  weekRange,
} from '../common/date/local-day';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus as Status } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitScheduleVersionEntity } from '../habits/entities/habit-schedule-version.entity';
import { HabitScheduleType } from '../habits/enums/habit-schedule-type.enum';
import {
  expiresAt,
  isScheduledOn,
  slotStartsAt,
} from '../habits/scheduling/schedule-rules';
import { runRefusal } from '../habits/scheduling/run-actionability';

/**
 * The counting rule of a Monats-Challenge (docs/challenges.md), without a
 * database: which runs of the Daily were due in the challenge's days, which
 * of them were done, which were missed and which can still be done.
 *
 * The rhythm is the Daily's own, version by version, as the scheduler reads
 * it (`isScheduledOn`, `slotStartsAt`, `expiresAt`). Unlike the series, the
 * challenge is strict: a run skipped by hand counts as missed.
 */

/** The days a challenge counts, both included. */
export type ChallengeWindow = { first: string; last: string };

/** What the rule reads of a stored run. */
export type ChallengeRun = Pick<
  HabitOccurrenceEntity,
  | 'id'
  | 'scheduleVersionId'
  | 'scheduledDate'
  | 'movedToDate'
  | 'status'
  | 'resolvedDate'
>;

export type ChallengeTally = {
  /** Due runs done within the window. */
  done: number;
  /** Due runs that can no longer be done: skipped, run out or left open. */
  missed: number;
  /** Due runs still possible: today's open run and the days to come. */
  remaining: number;
};

/** Today's run of the challenge's Daily, for Heute and the reminder. */
export type ChallengeToday =
  | { state: 'open'; occurrenceId: number }
  | { state: 'done' }
  | { state: 'none' };

type Outcome = 'done' | 'missed' | 'remaining';

const DAYS_PER_WEEK = 7;

function daysOf({ first, last }: ChallengeWindow): string[] {
  const days: string[] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) days.push(day);
  return days;
}

const isWeekly = (version: HabitScheduleVersionEntity) =>
  version.type === HabitScheduleType.WEEKLY_TARGET;

/**
 * The slots of the fixed rhythms (every n days, weekdays) in the window, as
 * the scheduler generates them: on a day of the version, starting before the
 * version ended.
 */
function fixedSlots(
  versions: HabitScheduleVersionEntity[],
  window: ChallengeWindow,
): { version: HabitScheduleVersionEntity; date: string }[] {
  const slots: { version: HabitScheduleVersionEntity; date: string }[] = [];
  for (const version of versions) {
    if (version.cancelledAt !== null || isWeekly(version)) continue;
    for (const date of daysOf(window))
      if (
        isScheduledOn(version, date) &&
        (version.endsAt === null ||
          slotStartsAt(version, date) < version.endsAt)
      )
        slots.push({ version, date });
  }
  return slots;
}

/**
 * One slot of a fixed rhythm. A stored run decides by its status; a slot
 * without one (not generated yet, or the Daily was paused) counts by the
 * clock like an open run.
 */
function slotOutcome(
  version: HabitScheduleVersionEntity,
  date: string,
  run: ChallengeRun | undefined,
  window: ChallengeWindow,
  now: Date,
): Outcome | null {
  switch (run?.status) {
    case Status.CANCELLED:
      // A schedule change, or a second run on a day already done: never due.
      return null;
    case Status.COMPLETED:
      return run.resolvedDate === null || run.resolvedDate <= window.last
        ? 'done'
        : 'missed';
    case Status.SKIPPED:
      // Strict: skipped by hand is missed too.
      return 'missed';
    default:
      if (dayOf(now) > window.last) return 'missed';
      return expiresAt(version, date) <= now ? 'missed' : 'remaining';
  }
}

function fixedTally(
  versions: HabitScheduleVersionEntity[],
  runs: ChallengeRun[],
  window: ChallengeWindow,
  now: Date,
): ChallengeTally {
  const fixed = new Map(
    versions
      .filter((version) => !isWeekly(version))
      .map((version) => [version.id, version]),
  );
  const stored = new Map<string, ChallengeRun>();
  for (const run of runs)
    if (
      fixed.has(run.scheduleVersionId) &&
      run.scheduledDate >= window.first &&
      run.scheduledDate <= window.last
    )
      stored.set(`${run.scheduleVersionId}:${run.scheduledDate}`, run);

  const slots = new Map<
    string,
    { version: HabitScheduleVersionEntity; date: string }
  >();
  for (const slot of fixedSlots(versions, window))
    slots.set(`${slot.version.id}:${slot.date}`, slot);
  // A stored run the rule would not generate today still was due.
  for (const [key, run] of stored)
    if (!slots.has(key))
      slots.set(key, {
        version: fixed.get(run.scheduleVersionId)!,
        date: run.scheduledDate,
      });

  const tally: ChallengeTally = { done: 0, missed: 0, remaining: 0 };
  for (const [key, { version, date }] of slots) {
    const outcome = slotOutcome(version, date, stored.get(key), window, now);
    if (outcome) tally[outcome] += 1;
  }
  return tally;
}

/** The weekly target in force on `day`, or null under a fixed rhythm. */
function weeklyTargetOn(
  versions: HabitScheduleVersionEntity[],
  day: string,
): number | null {
  const starts = startOfDay(day);
  const targets = versions
    .filter(
      (version) =>
        version.cancelledAt === null &&
        isWeekly(version) &&
        dayOf(version.effectiveAt) <= day &&
        (version.endsAt === null || starts < version.endsAt),
    )
    .map((version) => version.weeklyTarget ?? 1);
  return targets.length ? Math.max(...targets) : null;
}

/**
 * How many runs a weekly target asks for in the part of a week the window
 * covers: the target in proportion to the covered days, rounded to the
 * nearest whole run (a seventh never lands on a half). A whole week asks
 * for the full target; never more runs than covered days.
 */
export function weeklyDue(target: number, coveredDays: number): number {
  return Math.round((target * coveredDays) / DAYS_PER_WEEK);
}

/**
 * The weeks of a weekly target ("3× pro Woche"), each Monday to Sunday cut
 * to the window: `weeklyDue` runs are due in it, done runs count up to that
 * (a fourth run does not make up for another week). In a week still
 * running, what is left counts as still possible as far as there are days
 * left for it (one run a day); the rest is missed already.
 */
function weeklyTally(
  versions: HabitScheduleVersionEntity[],
  runs: ChallengeRun[],
  window: ChallengeWindow,
  now: Date,
): ChallengeTally {
  const today = dayOf(now);
  const over = today > window.last;
  const weekly = new Set(
    versions.filter(isWeekly).map((version) => version.id),
  );
  const doneOn = new Map<string, number>();
  for (const run of runs)
    if (
      weekly.has(run.scheduleVersionId) &&
      run.status === Status.COMPLETED &&
      run.resolvedDate !== null
    )
      doneOn.set(run.resolvedDate, (doneOn.get(run.resolvedDate) ?? 0) + 1);

  const weeks = new Map<string, { days: string[]; target: number }>();
  for (const day of daysOf(window)) {
    const target = weeklyTargetOn(versions, day);
    if (target === null) continue;
    const monday = weekRange(day).startDate;
    const week = weeks.get(monday) ?? { days: [], target: 0 };
    week.days.push(day);
    week.target = Math.max(week.target, target);
    weeks.set(monday, week);
  }

  const tally: ChallengeTally = { done: 0, missed: 0, remaining: 0 };
  for (const { days, target } of weeks.values()) {
    const due = weeklyDue(target, days.length);
    const completed = days.reduce(
      (sum, day) => sum + (doneOn.get(day) ?? 0),
      0,
    );
    const done = Math.min(completed, due);
    const open = due - done;
    const daysLeft = over
      ? 0
      : days.filter(
          (day) => day > today || (day === today && !doneOn.get(today)),
        ).length;
    const remaining = Math.min(open, daysLeft);
    tally.done += done;
    tally.remaining += remaining;
    tally.missed += open - remaining;
  }
  return tally;
}

/**
 * The tally of a challenge's days as of `now`: fixed rhythms slot by slot,
 * weekly targets week by week. Once the window is over nothing remains.
 */
export function challengeTally(
  versions: HabitScheduleVersionEntity[],
  runs: ChallengeRun[],
  window: ChallengeWindow,
  now: Date,
): ChallengeTally {
  if (window.first > window.last) return { done: 0, missed: 0, remaining: 0 };
  const fixed = fixedTally(versions, runs, window, now);
  const weekly = weeklyTally(versions, runs, window, now);
  return {
    done: fixed.done + weekly.done,
    missed: fixed.missed + weekly.missed,
    remaining: fixed.remaining + weekly.remaining,
  };
}

/**
 * Today's run, while today is a day of the challenge: the open run of the
 * window that can be done today (`runRefusal`; also one carried over into
 * today), else whether a run was done today, else none (nothing due today,
 * skipped, or the Daily is paused). The Daily may be read without bringing
 * its runs up to now (the reminder's last check), so this leaves out the
 * version in force: an open run of any version not cancelled counts while
 * its window is open.
 */
export function challengeToday(
  versions: HabitScheduleVersionEntity[],
  runs: ChallengeRun[],
  window: ChallengeWindow,
  now: Date,
  habit: { isActive: boolean },
): ChallengeToday {
  const today = dayOf(now);
  if (today < window.first || today > window.last) return { state: 'none' };
  const byId = new Map(versions.map((version) => [version.id, version]));
  const open = runs.find(
    (run) =>
      run.scheduledDate >= window.first &&
      runRefusal(
        { run, version: byId.get(run.scheduleVersionId), habit, now },
        { anyVersion: true },
      ) === null,
  );
  if (open) return { state: 'open', occurrenceId: open.id };
  return runs.some(
    (run) => run.status === Status.COMPLETED && run.resolvedDate === today,
  )
    ? { state: 'done' }
    : { state: 'none' };
}

/** Whole percent of the due runs that were done, rounded down: 100 only when all were. */
export function donePercent(done: number, due: number): number {
  return due > 0 ? Math.floor((done * 100) / due) : 0;
}
