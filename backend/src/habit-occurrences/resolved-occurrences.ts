import { EntityManager } from 'typeorm';
import { HabitOccurrenceEntity } from './entities/habit-occurrence.entity';
import { ownedOccurrences } from './owned-occurrences';

/**
 * Runs resolved on `firstDay`..`lastDay`, with their habit: a completed run
 * belongs to the day it was done, a skipped one to the day it was due. The
 * habit counterpart of `completedTodos`; history includes deleted habits.
 */
export function resolvedOccurrences(
  manager: EntityManager,
  userId: string,
  range: { firstDay: string; lastDay: string; withDeleted?: boolean },
): Promise<HabitOccurrenceEntity[]> {
  const query = range.withDeleted
    ? manager
        .getRepository(HabitOccurrenceEntity)
        .createQueryBuilder('occurrence')
        .withDeleted()
        .innerJoinAndSelect('occurrence.habit', 'habit')
        .where('"habit"."userId" = :userId', { userId })
    : ownedOccurrences(manager, userId, { select: true });
  return query
    .andWhere(
      `(
        ("occurrence"."status" = 'completed' AND "occurrence"."resolvedDate" BETWEEN :firstDay AND :lastDay)
        OR ("occurrence"."status" = 'skipped' AND "occurrence"."scheduledDate" BETWEEN :firstDay AND :lastDay)
      )`,
      { firstDay: range.firstDay, lastDay: range.lastDay },
    )
    .getMany();
}
