import { EntityManager, SelectQueryBuilder } from 'typeorm';
import { HabitOccurrenceEntity } from './entities/habit-occurrence.entity';

/**
 * Occurrences have no userId column: ownership is transitive through their
 * habit. This is the one query that applies it (and hides deleted habits).
 * The habit is joined as `habit`; pass `select: true` to load it.
 */
export function ownedOccurrences(
  manager: EntityManager,
  userId: string,
  options: { alias?: string; select?: boolean } = {},
): SelectQueryBuilder<HabitOccurrenceEntity> {
  const alias = options.alias ?? 'occurrence';
  const query = manager
    .getRepository(HabitOccurrenceEntity)
    .createQueryBuilder(alias);
  (options.select
    ? query.innerJoinAndSelect(`${alias}.habit`, 'habit')
    : query.innerJoin(`${alias}.habit`, 'habit')
  )
    .where('"habit"."userId" = :userId', { userId })
    .andWhere('"habit"."deletedAt" IS NULL');
  return query;
}
