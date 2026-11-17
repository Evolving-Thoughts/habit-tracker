import { EntityManager } from 'typeorm';
import { weekRange } from '../common/date/local-day';
import { HabitEntity } from '../habits/entities/habit.entity';
import { HabitScheduleVersionEntity } from '../habits/entities/habit-schedule-version.entity';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { ForecastSlot, forecastSlots, movedSlots } from './history-planning';

/** What planning habits on some days needs, read in one go. */
export type HabitForecast = {
  habits: HabitEntity[];
  versions: HabitScheduleVersionEntity[];
  /** Stored runs on or near the days, plus everything resolved that week. */
  occurrences: HabitOccurrenceEntity[];
  /** The runs due on the days, including runs moved into them. */
  slots: ForecastSlot[];
};

/**
 * Reads the habit runs of `dates` without reconciling or generating any:
 * stored runs where they exist, the schedule's forecast where they do not
 * yet. History and the week plan both project habits through this read, so
 * they show the same runs on the same days.
 */
export async function loadHabitForecast(
  manager: EntityManager,
  userId: string,
  dates: string[],
  today: string,
  now: Date,
): Promise<HabitForecast> {
  const habits = await manager
    .getRepository(HabitEntity)
    .find({ where: { userId, isActive: true } });
  if (!habits.length)
    return { habits, versions: [], occurrences: [], slots: [] };
  const ids = habits.map((habit) => habit.id);
  const versions = await manager
    .getRepository(HabitScheduleVersionEntity)
    .createQueryBuilder('version')
    .where('"version"."habitId" IN (:...ids)', { ids })
    .andWhere('"version"."cancelledAt" IS NULL')
    .orderBy('"version"."effectiveAt"', 'ASC')
    .addOrderBy('"version"."id"', 'ASC')
    .getMany();
  const slots = forecastSlots(versions, dates, today, now);
  const earliest = slots.reduce(
    (date, slot) => (slot.scheduledDate < date ? slot.scheduledDate : date),
    dates[0],
  );
  // Target progress is scoped to the calendar week of the first day.
  const { startDate: weekStart, endDate: weekEnd } = weekRange(dates[0]);
  const occurrences = await manager
    .getRepository(HabitOccurrenceEntity)
    .createQueryBuilder('occurrence')
    .where('"occurrence"."habitId" IN (:...ids)', { ids })
    .andWhere(
      '("occurrence"."scheduledDate" BETWEEN :earliest AND :end OR "occurrence"."movedToDate" BETWEEN :first AND :end OR "occurrence"."resolvedDate" BETWEEN :weekStart AND :weekEnd)',
      {
        earliest,
        first: dates[0],
        end: dates[dates.length - 1],
        weekStart,
        weekEnd,
      },
    )
    .getMany();
  slots.push(...movedSlots(versions, occurrences, slots, dates));
  return { habits, versions, occurrences, slots };
}
