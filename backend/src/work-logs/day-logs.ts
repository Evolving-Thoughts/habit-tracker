import { EntityManager, LessThan, MoreThan } from 'typeorm';
import { endOfDay, startOfDay } from '../common/date/local-day';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import type { Campaign, TodoAncestry } from '../todos/todo-ancestry';
import { WorkLogEntity } from './work-log.entity';

/** A work log with the habit of its run and the campaign it worked towards. */
export type CampaignLog = WorkLogEntity & {
  habitId: number | null;
  campaign: Campaign | null;
};

/**
 * The user's work logs that cover part of these days. A stretch across
 * midnight belongs to both days; `onDay` in work-time.ts cuts it to each.
 */
export function logsOfDays(
  manager: EntityManager,
  userId: string,
  firstDay: string,
  lastDay: string = firstDay,
): Promise<WorkLogEntity[]> {
  return manager.find(WorkLogEntity, {
    where: {
      userId,
      startedAt: LessThan(endOfDay(lastDay)),
      endedAt: MoreThan(startOfDay(firstDay)),
    },
    order: { startedAt: 'ASC', id: 'ASC' },
  });
}

/**
 * Adds the campaign each log worked towards, as the planner names it today.
 * A log keeps only plain target ids, so a run is looked up for its habit,
 * also when that habit was deleted since.
 */
export async function withCampaigns(
  manager: EntityManager,
  userId: string,
  logs: WorkLogEntity[],
  ancestry: TodoAncestry,
): Promise<CampaignLog[]> {
  const occurrenceIds = logs.flatMap((log) =>
    log.occurrenceId === null ? [] : [log.occurrenceId],
  );
  const runs = occurrenceIds.length
    ? await manager
        .getRepository(HabitOccurrenceEntity)
        .createQueryBuilder('occurrence')
        .withDeleted()
        .innerJoin('occurrence.habit', 'habit')
        .select(['occurrence.id', 'occurrence.habitId'])
        .where('"habit"."userId" = :userId', { userId })
        .andWhere('"occurrence"."id" IN (:...occurrenceIds)', {
          occurrenceIds,
        })
        .getMany()
    : [];
  const habitOf = new Map(runs.map((run) => [run.id, run.habitId]));
  return logs.map((log) => {
    const habitId =
      log.occurrenceId === null
        ? null
        : (habitOf.get(log.occurrenceId) ?? null);
    const campaign =
      log.todoId !== null
        ? ancestry.todoCampaign(log.todoId)
        : habitId === null
          ? null
          : ancestry.habitCampaign(habitId);
    return { ...log, habitId, campaign };
  });
}
