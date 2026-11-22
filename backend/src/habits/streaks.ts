import { EntityManager, In } from 'typeorm';
import { midnightInTimeZone } from '../common/date/date-only.utils';
import { addDays, dayOf, weekRange } from '../common/date/local-day';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus as Status } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitScheduleVersionEntity } from './entities/habit-schedule-version.entity';
import { HabitScheduleType } from './enums/habit-schedule-type.enum';
import { expiresAt } from './scheduling/schedule-rules';

/**
 * A Daily's series (Serie): how many due runs in a row were done up to now,
 * and the longest such run ever. See docs/streaks.md for the rule.
 */
export type Streak = {
  current: number;
  best: number;
  /** What it counts: runs, or weeks while the rhythm is a weekly goal. */
  unit: StreakUnit;
  recentDays?: { date: string; state: DayState }[];
};
export type StreakUnit = 'runs' | 'weeks';

export const NO_STREAK: Streak = { current: 0, best: 0, unit: 'runs' };

type StreakOccurrence = Pick<
  HabitOccurrenceEntity,
  'scheduleVersionId' | 'scheduledDate' | 'status' | 'resolvedDate'
>;

/** What one due run (or, for a weekly goal, one week) means for the series. */
type Outcome = 'done' | 'missed' | 'neutral';
type DayState = 'done' | 'missed' | 'open' | 'skipped' | 'free';
const dayPriority: DayState[] = ['free', 'skipped', 'open', 'missed', 'done'];
type Unit = { at: string; outcome: Outcome };

/**
 * A skipped run was skipped by hand only while it could still be done: the
 * scheduler skips a run on or after the day its window closed (a missed run),
 * a person only before. Both store the status `skipped` with the day it
 * happened, so the day tells them apart, for old runs too.
 */
function skippedByHand(
  version: HabitScheduleVersionEntity,
  occurrence: StreakOccurrence,
): boolean {
  if (occurrence.resolvedDate === null) return true;
  return (
    occurrence.resolvedDate <
    dayOf(expiresAt(version, occurrence.scheduledDate))
  );
}

/** A run of a fixed rhythm (interval or weekdays), at its slot. */
function runUnit(
  version: HabitScheduleVersionEntity,
  occurrence: StreakOccurrence,
  now: Date,
): Unit {
  const at = occurrence.scheduledDate;
  switch (occurrence.status) {
    case Status.COMPLETED:
      return { at, outcome: 'done' };
    case Status.SKIPPED:
      return {
        at,
        outcome: skippedByHand(version, occurrence) ? 'neutral' : 'missed',
      };
    case Status.PENDING:
      // Still open (today's run, or one carried over within its window).
      return {
        at,
        outcome:
          expiresAt(version, occurrence.scheduledDate) <= now
            ? 'missed'
            : 'neutral',
      };
    default:
      // Cancelled by a schedule change, a reached weekly goal or a second run
      // on a day already done: it was never due as such.
      return { at, outcome: 'neutral' };
  }
}

/**
 * The weeks of a weekly goal: a week counts when its goal was met. The week
 * still running, and a week the goal only covered in part (it began or ended
 * mid-week), break nothing when the goal is not (yet) met. A week without
 * any run (the Daily was paused) is no unit at all.
 */
function weekUnits(
  entries: {
    version: HabitScheduleVersionEntity;
    occurrence: StreakOccurrence;
  }[],
  today: string,
): Unit[] {
  const weeks = new Map<
    string,
    { versions: HabitScheduleVersionEntity[]; completed: number }
  >();
  const weekOf = (day: string) => {
    const monday = weekRange(day).startDate;
    let week = weeks.get(monday);
    if (!week) {
      week = { versions: [], completed: 0 };
      weeks.set(monday, week);
    }
    return week;
  };
  for (const { version, occurrence } of entries) {
    const completed =
      occurrence.status === Status.COMPLETED &&
      occurrence.resolvedDate !== null;
    const week = weekOf(
      completed ? occurrence.resolvedDate! : occurrence.scheduledDate,
    );
    if (completed) week.completed += 1;
    if (!week.versions.includes(version)) week.versions.push(version);
  }
  return [...weeks].map(([monday, week]) => {
    const sunday = addDays(monday, 6);
    const target = Math.max(
      1,
      ...week.versions.map((version) => version.weeklyTarget ?? 1),
    );
    if (week.completed >= target) return { at: sunday, outcome: 'done' };
    const starts = midnightInTimeZone(monday);
    const ends = midnightInTimeZone(addDays(monday, 7));
    const partial = week.versions.some(
      (version) =>
        version.effectiveAt > starts ||
        (version.endsAt !== null && version.endsAt < ends),
    );
    return {
      at: sunday,
      outcome: today <= sunday || partial ? 'neutral' : 'missed',
    };
  });
}

/**
 * The series of one Daily from all its runs and schedule versions, as of
 * `now` (Berlin days). Done runs in a row count; a run skipped by hand
 * neither counts nor breaks; a missed run (due, its window over, neither
 * done nor skipped by hand) breaks the series; what is still open breaks
 * nothing yet. A weekly goal counts weeks instead of runs.
 */
export function habitStreak(
  versions: HabitScheduleVersionEntity[],
  occurrences: StreakOccurrence[],
  now: Date,
  includeRecentDays = false,
): Streak {
  const byId = new Map(versions.map((version) => [version.id, version]));
  const units: Unit[] = [];
  const today = dayOf(now);
  const recent = new Map<string, DayState>();
  if (includeRecentDays) {
    for (let offset = -13; offset <= 0; offset++)
      recent.set(addDays(today, offset), 'free');
  }
  function mark(date: string, state: DayState): void {
    const existing = recent.get(date);
    if (existing && dayPriority.indexOf(state) > dayPriority.indexOf(existing))
      recent.set(date, state);
  }
  const weekly: {
    version: HabitScheduleVersionEntity;
    occurrence: StreakOccurrence;
  }[] = [];
  for (const occurrence of occurrences) {
    const version = byId.get(occurrence.scheduleVersionId);
    if (!version) continue;
    if (version.type === HabitScheduleType.WEEKLY_TARGET) {
      weekly.push({ version, occurrence });
      if (includeRecentDays && occurrence.status === Status.COMPLETED)
        mark(occurrence.resolvedDate ?? occurrence.scheduledDate, 'done');
    } else {
      const unit = runUnit(version, occurrence, now);
      units.push(unit);
      if (includeRecentDays && occurrence.status !== Status.CANCELLED) {
        const state =
          unit.outcome === 'neutral'
            ? occurrence.status === Status.PENDING
              ? 'open'
              : 'skipped'
            : unit.outcome;
        mark(unit.at, state);
      }
    }
  }
  units.push(...weekUnits(weekly, today));
  units.sort((first, second) => first.at.localeCompare(second.at));

  let current = 0;
  let best = 0;
  for (const { outcome } of units) {
    if (outcome === 'done') {
      current += 1;
      best = Math.max(best, current);
    } else if (outcome === 'missed') current = 0;
  }
  const streak: Streak = { current, best, unit: streakUnit(versions, now) };
  if (includeRecentDays)
    streak.recentDays = Array.from(recent, ([date, state]) => ({
      date,
      state,
    }));
  return streak;
}

/** Weeks while the rhythm in force (else the first one) is a weekly goal. */
function streakUnit(
  versions: HabitScheduleVersionEntity[],
  now: Date,
): StreakUnit {
  const usable = versions
    .filter((version) => version.cancelledAt === null)
    .sort((a, b) => a.effectiveAt.getTime() - b.effectiveAt.getTime());
  const started = usable.filter((version) => version.effectiveAt <= now);
  const rhythm = started[started.length - 1] ?? usable[0];
  return rhythm?.type === HabitScheduleType.WEEKLY_TARGET ? 'weeks' : 'runs';
}

/**
 * The series of each of the habits, from one read of their versions and
 * runs (only the columns the rule needs). Habits without runs get none.
 */
export async function loadStreaks(
  manager: EntityManager,
  habitIds: number[],
  now: Date,
  includeRecentDays = false,
): Promise<Map<number, Streak>> {
  const ids = [...new Set(habitIds)];
  const result = new Map<number, Streak>();
  if (!ids.length) return result;
  const [versions, occurrences] = await Promise.all([
    manager.getRepository(HabitScheduleVersionEntity).find({
      where: { habitId: In(ids) },
    }),
    manager.getRepository(HabitOccurrenceEntity).find({
      select: {
        id: true,
        habitId: true,
        scheduleVersionId: true,
        scheduledDate: true,
        status: true,
        resolvedDate: true,
      },
      where: { habitId: In(ids) },
    }),
  ]);
  for (const id of ids)
    result.set(
      id,
      habitStreak(
        versions.filter((version) => version.habitId === id),
        occurrences.filter((occurrence) => occurrence.habitId === id),
        now,
        includeRecentDays,
      ),
    );
  return result;
}
