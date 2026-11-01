import { Brackets, EntityManager } from 'typeorm';
import { occurrenceDueDate } from '../habit-occurrences/entities/habit-occurrence.entity';
import { WorkLogEntity } from '../work-logs/work-log.entity';
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
  occurrence: {
    status: string;
    scheduledDate: string;
    movedToDate?: string | null;
  },
  habit: { isActive: boolean },
  today: string,
): boolean {
  return (
    habit.isActive &&
    occurrence.status === 'pending' &&
    occurrenceDueDate(occurrence) <= today
  );
}

/** Planned minutes of an occurrence, falling back to its habit's default. */
export function effectiveDuration(
  occurrence: { plannedDurationMinutes: number | null },
  habit: { plannedDurationMinutes: number | null },
): number | null {
  return occurrence.plannedDurationMinutes ?? habit.plannedDurationMinutes;
}

/** Logs the running stretch of a timer up to `end`, never past its deadline. */
export async function closeWorkSegment(
  manager: EntityManager,
  timer: TimerEntity,
  end: Date,
): Promise<void> {
  const startedAt = timer.segmentStartedAt;
  timer.segmentStartedAt = null;
  if (!startedAt) return;
  const endedAt =
    timer.endsAt && timer.endsAt < end ? new Date(timer.endsAt) : end;
  if (endedAt <= startedAt) return;
  await manager.insert(WorkLogEntity, {
    userId: timer.userId,
    todoId: timer.todoId,
    occurrenceId: timer.occurrenceId,
    title: timer.title,
    startedAt,
    endedAt,
    source: 'timer',
  });
}

/** Ends a timer for good: its work stays on record, its row stops counting. */
export async function stopTimer(
  manager: EntityManager,
  timer: TimerEntity,
  at: Date,
): Promise<TimerEntity> {
  await closeWorkSegment(manager, timer, at);
  timer.state = 'stopped';
  timer.endsAt = null;
  return manager.save(TimerEntity, timer);
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
  at: Date,
): Promise<void> {
  const todoIds = targets.todoIds ?? [];
  const occurrenceIds = targets.occurrenceIds ?? [];
  const { habitId } = targets;
  if (!todoIds.length && !occurrenceIds.length && habitId === undefined) return;
  const timers = await manager
    .getRepository(TimerEntity)
    .createQueryBuilder('timer')
    .where('"timer"."userId" = :userId', { userId })
    .andWhere(`"timer"."state" <> 'stopped'`)
    .andWhere(
      new Brackets((query) => {
        // Array parameters keep one bind value regardless of list length.
        if (todoIds.length)
          query.orWhere('"timer"."todoId" = ANY(:todoIds)', { todoIds });
        if (occurrenceIds.length)
          query.orWhere('"timer"."occurrenceId" = ANY(:occurrenceIds)', {
            occurrenceIds,
          });
        // Every occurrence of a paused or deleted habit.
        if (habitId !== undefined)
          query.orWhere(
            '"timer"."occurrenceId" IN (SELECT "id" FROM "habit_occurrences" WHERE "habitId" = :habitId)',
            { habitId },
          );
      }),
    )
    .getMany();
  for (const timer of timers) await stopTimer(manager, timer, at);
}

/** Whether a running or paused timer is attached to this target. */
export function hasOpenTimer(
  manager: EntityManager,
  userId: string,
  target: { todoId: number } | { occurrenceId: number },
): Promise<boolean> {
  return manager.getRepository(TimerEntity).exists({
    where: [
      { userId, state: 'running', ...target },
      { userId, state: 'paused', ...target },
    ],
  });
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
  at: Date,
): Promise<void> {
  if (!todoIds.length) return;
  await releaseTimers(manager, userId, { todoIds }, at);
  await manager
    .createQueryBuilder()
    .delete()
    .from(TimerEntity)
    .where('"userId" = :userId', { userId })
    .andWhere('"todoId" = ANY(:todoIds)', { todoIds })
    .execute();
}
