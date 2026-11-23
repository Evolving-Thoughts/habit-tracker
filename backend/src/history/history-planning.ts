import { midnightInTimeZone } from '../common/date/date-only.utils';
import { endOfDay } from '../common/date/local-day';
import { HabitEntity } from '../habits/entities/habit.entity';
import { HabitScheduleVersionEntity } from '../habits/entities/habit-schedule-version.entity';
import { HabitScheduleType } from '../habits/enums/habit-schedule-type.enum';
import {
  effectiveDuration,
  HabitOccurrenceEntity,
} from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus as Status } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import {
  expiresAt,
  isScheduledOn,
  lastMovableDate,
  latestSlotOnOrBefore,
  slotStartsAt,
} from '../habits/scheduling/schedule-rules';
import {
  completedBetween,
  isCompletedOn,
} from '../habits/scheduling/occurrence-lifecycle';
import { HistoryPlannedItem, HistoryWeeklyTarget } from './history.dto';
import { sortInDay } from '../day-planner/day-order';

/** What a planned run shows beside its own fields, resolved by the caller. */
export type PlannedContext = Pick<
  HistoryPlannedItem,
  'categoryName' | 'categoryColor' | 'why' | 'campaign'
>;

/** Without a caller's lookups: no category or campaign, the habit's own reason. */
const ownContext = (habit: HabitEntity): PlannedContext => ({
  categoryName: null,
  categoryColor: null,
  why: habit.why ?? null,
  campaign: null,
});

export type ForecastSlot = {
  version: HabitScheduleVersionEntity;
  date: string;
  scheduledDate: string;
};
export function forecastSlots(
  versions: HabitScheduleVersionEntity[],
  dates: string[],
  today: string,
  now: Date,
): ForecastSlot[] {
  const result: ForecastSlot[] = [];
  for (const version of versions) {
    if (
      version.cancelledAt !== null ||
      version.type === HabitScheduleType.WEEKLY_TARGET
    )
      continue;
    for (const date of dates) {
      if (date < today) continue;
      // Today may still show the latest unexpired slot (carry-over).
      const candidate =
        date === today ? latestSlotOnOrBefore(version, date) : date;
      if (candidate === null) continue;
      if (!isScheduledOn(version, candidate)) continue;
      const starts = slotStartsAt(version, candidate);
      if (
        version.endsAt !== null &&
        (starts >= version.endsAt || (date === today && version.endsAt <= now))
      )
        continue;
      if (date === today && expiresAt(version, candidate) <= now) continue;
      result.push({ version, date, scheduledDate: candidate });
    }
  }
  return result;
}
/** Slots of runs moved into `dates` from a slot outside of them. */
export function movedSlots(
  versions: HabitScheduleVersionEntity[],
  occurrences: HabitOccurrenceEntity[],
  slots: ForecastSlot[],
  dates: string[],
): ForecastSlot[] {
  const known = new Set(
    slots.map((slot) => `${slot.version.id}:${slot.scheduledDate}`),
  );
  return occurrences.flatMap((occurrence) => {
    const { movedToDate, scheduledDate, scheduleVersionId } = occurrence;
    const version = versions.find((item) => item.id === scheduleVersionId);
    if (
      !version ||
      movedToDate === null ||
      occurrence.status !== Status.PENDING ||
      !dates.includes(movedToDate) ||
      known.has(`${scheduleVersionId}:${scheduledDate}`)
    )
      return [];
    return [{ version, date: movedToDate, scheduledDate }];
  });
}
export function plannedHabits(
  habits: HabitEntity[],
  slots: ForecastSlot[],
  occurrences: HabitOccurrenceEntity[],
  today: string,
  context: (habit: HabitEntity) => PlannedContext = ownContext,
): HistoryPlannedItem[] {
  const byId = new Map(habits.map((habit) => [habit.id, habit]));
  const existing = new Map(
    occurrences.map((item) => [
      `${item.scheduleVersionId}:${item.scheduledDate}`,
      item,
    ]),
  );
  const completedToday = new Set(
    occurrences
      .filter((item) => isCompletedOn(item, today))
      .map((item) => item.habitId),
  );
  return slots.flatMap((slot) => {
    const habit = byId.get(slot.version.habitId);
    const stored = existing.get(`${slot.version.id}:${slot.scheduledDate}`);
    if (
      !habit ||
      !habit.isActive ||
      habit.deletedAt !== null ||
      (stored && stored.status !== Status.PENDING) ||
      (slot.date === today && completedToday.has(habit.id))
    )
      return [];
    return [
      {
        key: `habit:${slot.version.id}:${slot.scheduledDate}`,
        type: 'habit' as const,
        id: stored?.id ?? null,
        habitId: habit.id,
        title: habit.title,
        ...context(habit),
        date: stored?.movedToDate ?? slot.date,
        scheduledDate: slot.scheduledDate,
        isOverdue: (stored?.movedToDate ?? slot.scheduledDate) < today,
        timeOfDay: habit.timeOfDay ?? null,
        moveUntil: stored
          ? lastMovableDate(slot.version, slot.scheduledDate)
          : null,
        plannedDurationMinutes: stored
          ? effectiveDuration(stored, habit)
          : habit.plannedDurationMinutes,
      },
    ];
  });
}
/**
 * Today's open runs of Dailies with a weekly target. A weekly target has no
 * slots to forecast; the generator stores one run a day until the target is
 * reached, and Heute lists that run. Kalender and Plan show the same run on
 * today, so all of them count the same day (see the frontend's day tally).
 * Runs moved into a day are already slots (`movedSlots`).
 */
export function openTargetRuns(
  habits: HabitEntity[],
  versions: HabitScheduleVersionEntity[],
  occurrences: HabitOccurrenceEntity[],
  today: string,
  context: (habit: HabitEntity) => PlannedContext = ownContext,
): HistoryPlannedItem[] {
  return occurrences.flatMap((occurrence) => {
    const habit = habits.find((item) => item.id === occurrence.habitId);
    const version = versions.find(
      (item) => item.id === occurrence.scheduleVersionId,
    );
    if (
      !habit ||
      !habit.isActive ||
      habit.deletedAt !== null ||
      !version ||
      version.cancelledAt !== null ||
      version.type !== HabitScheduleType.WEEKLY_TARGET ||
      occurrence.status !== Status.PENDING ||
      occurrence.movedToDate !== null ||
      occurrence.scheduledDate !== today
    )
      return [];
    return [
      {
        key: `habit:${version.id}:${occurrence.scheduledDate}`,
        type: 'habit' as const,
        id: occurrence.id,
        habitId: habit.id,
        title: habit.title,
        ...context(habit),
        date: today,
        scheduledDate: occurrence.scheduledDate,
        isOverdue: false,
        timeOfDay: habit.timeOfDay ?? null,
        moveUntil: lastMovableDate(version, occurrence.scheduledDate),
        plannedDurationMinutes: effectiveDuration(occurrence, habit),
      },
    ];
  });
}

export function weeklyTargets(
  habits: HabitEntity[],
  versions: HabitScheduleVersionEntity[],
  occurrences: HabitOccurrenceEntity[],
  dates: string[],
  today: string,
  now: Date,
  countRange = { startDate: dates[0], endDate: dates[dates.length - 1] },
): HistoryWeeklyTarget[] {
  const result: HistoryWeeklyTarget[] = [];
  for (const version of versions) {
    const habit = habits.find((item) => item.id === version.habitId);
    if (
      !habit ||
      !habit.isActive ||
      habit.deletedAt !== null ||
      version.cancelledAt !== null ||
      version.type !== HabitScheduleType.WEEKLY_TARGET ||
      version.weeklyTarget === null ||
      (version.endsAt !== null && version.endsAt <= version.effectiveAt)
    )
      continue;
    const activeDates = dates.filter(
      (date) =>
        date >= today &&
        version.effectiveAt < endOfDay(date) &&
        (version.endsAt === null ||
          version.endsAt >
            new Date(
              Math.max(
                midnightInTimeZone(date).getTime(),
                date === today ? now.getTime() : 0,
              ),
            )),
    );
    if (!activeDates.length) continue;
    const completed = completedBetween(
      occurrences.filter((item) => item.habitId === habit.id),
      countRange.startDate,
      countRange.endDate,
    );
    result.push({
      key: `weekly:${version.id}`,
      habitId: habit.id,
      title: habit.title,
      target: version.weeklyTarget,
      completed,
      remaining: Math.max(0, version.weeklyTarget - completed),
      fromDate: activeDates[0],
      untilDate: activeDates[activeDates.length - 1],
    });
  }
  return result;
}
/**
 * Open entries sorted the way Heute and the Plan sort a day (day-order.ts):
 * what waits from an earlier day first, then the order the user sorted
 * the day into, appointments anchored in it by clock. Forecast runs are
 * never sorted: untimed ones come last by title, timed ones stand right
 * after the appointment before them on the clock. Completed and skipped
 * entries keep their own order, the time they were resolved.
 */
export function sortedLikeToday(
  items: HistoryPlannedItem[],
  positions: ReadonlyMap<string, number | null>,
): HistoryPlannedItem[] {
  const order = (item: HistoryPlannedItem) => ({
    scheduledDate: item.isOverdue ? item.scheduledDate : item.date,
    timeOfDay: item.timeOfDay,
    dayPosition: positions.get(item.key) ?? null,
    id: item.id ?? Number.MAX_SAFE_INTEGER,
  });
  return sortInDay(
    items,
    order,
    (first, second) =>
      first.title.localeCompare(second.title, 'de') ||
      first.key.localeCompare(second.key),
  );
}
