import { midnightInTimeZone } from '../common/date/date-only.utils';
import { endOfDay } from '../common/date/local-day';
import { HabitEntity } from '../habits/entities/habit.entity';
import { HabitScheduleVersionEntity } from '../habits/entities/habit-schedule-version.entity';
import { HabitScheduleType } from '../habits/enums/habit-schedule-type.enum';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus as Status } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import {
  expiresAt,
  isScheduledOn,
  latestSlotOnOrBefore,
  slotStartsAt,
} from '../habits/scheduling/schedule-rules';
import { HistoryPlannedItem, HistoryWeeklyTarget } from './history.dto';
import { effectiveDuration } from '../timers/timer-target';

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
export function plannedHabits(
  habits: HabitEntity[],
  slots: ForecastSlot[],
  occurrences: HabitOccurrenceEntity[],
  today: string,
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
      .filter(
        (item) =>
          item.status === Status.COMPLETED && item.resolvedDate === today,
      )
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
        date: slot.date,
        scheduledDate: slot.scheduledDate,
        isOverdue: slot.scheduledDate < today,
        plannedDurationMinutes: stored
          ? effectiveDuration(stored, habit)
          : habit.plannedDurationMinutes,
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
    // The scheduler counts all completions of this habit in the calendar week,
    // including completions under a previous rule, not just this version.
    const completed = occurrences.filter(
      (item) =>
        item.habitId === habit.id &&
        item.status === Status.COMPLETED &&
        item.resolvedDate !== null &&
        item.resolvedDate >= countRange.startDate &&
        item.resolvedDate <= countRange.endDate,
    ).length;
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
