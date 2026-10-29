import { Brackets, EntityManager } from 'typeorm';
import { TimerEntity } from './timer.entity';

/**
 * Timer targets: which todo or habit occurrence may carry a timer, how long
 * it runs by default, and what happens to a timer when its target stops
 * being eligible. Pure rules plus one write; no Nest dependencies, so todos,
 * habits, day planner and history can all use it without module cycles.
 */
export const TIMER_MIN_MINUTES = 1;
export const TIMER_MAX_MINUTES = 10080;

export function isValidTimerDuration(minutes: unknown): minutes is number {
  return (
    Number.isInteger(minutes) &&
    (minutes as number) >= TIMER_MIN_MINUTES &&
    (minutes as number) <= TIMER_MAX_MINUTES
  );
}

/** A todo can carry a timer while it is open. */
export function isTodoTimerEligible(todo: { completed: boolean }): boolean {
  return !todo.completed;
}

/** An occurrence can carry a timer while pending, due and its habit active. */
export function isOccurrenceTimerEligible(
  occurrence: { status: string; scheduledDate: string },
  habit: { isActive: boolean },
  today: string,
): boolean {
  return (
    habit.isActive &&
    occurrence.status === 'pending' &&
    occurrence.scheduledDate <= today
  );
}

/** Planned minutes of an occurrence, falling back to its habit's default. */
export function effectiveDuration(
  occurrence: { plannedDurationMinutes: number | null },
  habit: { plannedDurationMinutes: number | null },
): number | null {
  return occurrence.plannedDurationMinutes ?? habit.plannedDurationMinutes;
}

/**
 * Stops every timer of these targets right away. Call it in the same locked
 * transaction that makes a target ineligible (completed, deleted, skipped,
 * paused habit), so no timer keeps running for it until the next read.
 */
export async function releaseTimers(
  manager: EntityManager,
  userId: string,
  targets: { todoIds?: number[]; occurrenceIds?: number[]; habitId?: number },
): Promise<void> {
  const todoIds = targets.todoIds ?? [];
  const occurrenceIds = targets.occurrenceIds ?? [];
  const { habitId } = targets;
  if (!todoIds.length && !occurrenceIds.length && habitId === undefined) return;
  await manager
    .createQueryBuilder()
    .update(TimerEntity)
    .set({ state: 'stopped', endsAt: null })
    .where('"userId" = :userId', { userId })
    .andWhere(`"state" <> 'stopped'`)
    .andWhere(
      new Brackets((query) => {
        // Array parameters keep one bind value regardless of list length.
        if (todoIds.length)
          query.orWhere('"todoId" = ANY(:todoIds)', { todoIds });
        if (occurrenceIds.length)
          query.orWhere('"occurrenceId" = ANY(:occurrenceIds)', {
            occurrenceIds,
          });
        // Every occurrence of a paused or deleted habit.
        if (habitId !== undefined)
          query.orWhere(
            '"occurrenceId" IN (SELECT "id" FROM "habit_occurrences" WHERE "habitId" = :habitId)',
            { habitId },
          );
      }),
    )
    .execute();
}

/** Timers (any state) that belong to these todos, for previews of destructive changes. */
export function timersOfTodos(
  manager: EntityManager,
  userId: string,
  todoIds: number[],
): Promise<TimerEntity[]> {
  if (!todoIds.length) return Promise.resolve([]);
  return manager
    .getRepository(TimerEntity)
    .createQueryBuilder('timer')
    .where('"timer"."userId" = :userId', { userId })
    .andWhere('"timer"."todoId" = ANY(:todoIds)', { todoIds })
    .orderBy('"timer"."id"', 'ASC')
    .getMany();
}

/** Deletes the timer rows of deleted todos (their history lives on the todos). */
export async function discardTimersOfTodos(
  manager: EntityManager,
  userId: string,
  todoIds: number[],
): Promise<void> {
  if (!todoIds.length) return;
  await manager
    .createQueryBuilder()
    .delete()
    .from(TimerEntity)
    .where('"userId" = :userId', { userId })
    .andWhere('"todoId" = ANY(:todoIds)', { todoIds })
    .execute();
}
