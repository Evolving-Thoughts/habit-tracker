import { Brackets, EntityManager } from 'typeorm';
import { WorkLogEntity } from '../work-logs/work-log.entity';
import { coveredMilliseconds } from '../work-logs/work-time';
import { TimerEntity } from './timer.entity';
import { StopwatchEvent, StopwatchState, transition } from './timer-transition';
import { focusBlockFollowsStopwatch } from '../focus-blocks/focus-block-store';

/**
 * Timer targets: which todo may carry a stopwatch (a habit run may while
 * `runRefusal` in `habits/scheduling/run-actionability.ts` allows it), the
 * adapter that stores a stopwatch event with its Logbuch writes
 * (`recordTransition`, the rules are in `timer-transition.ts`), and what
 * happens to a stopwatch when its target stops being eligible. No Nest
 * dependencies, so todos, habits, the calendar sync and the timers service
 * can all use it without module cycles.
 */
export const TIMER_MIN_MINUTES = 1;
export const TIMER_MAX_MINUTES = 10080;

/** A todo can carry a timer while it is open. */
export function isTodoTimerEligible(todo: { completed: boolean }): boolean {
  return !todo.completed;
}

/**
 * Runs one stopwatch event through `transition` (`timer-transition.ts`):
 * loads what it needs, writes its log operations and puts the next state on
 * the timer; the caller saves the timer. The block's log is read locked, so
 * a correction or deletion of it either happened before or waits until this
 * transaction ends. A pause or stop also ends the Fokus-Sperre that ends
 * with it (`focusBlockFollowsStopwatch`); a start or resume starts one in
 * `TimersService`, which knows the quest or daily.
 */
export async function recordTransition(
  manager: EntityManager,
  timer: TimerEntity,
  type: 'pause' | 'stop' | 'resume',
  at: Date,
): Promise<void> {
  const event: StopwatchEvent =
    type === 'resume'
      ? { type }
      : {
          type,
          blockLog:
            timer.workLogId !== null && timer.segmentStartedAt
              ? await manager.findOne(WorkLogEntity, {
                  select: { id: true, startedAt: true },
                  where: { id: timer.workLogId, userId: timer.userId },
                  lock: { mode: 'pessimistic_write' },
                })
              : null,
        };
  const { state, logOps } = transition(stopwatchState(timer), event, at);
  for (const operation of logOps) {
    if (operation.type === 'extend') {
      await manager.update(
        WorkLogEntity,
        { id: operation.id, userId: timer.userId },
        { endedAt: operation.endedAt },
      );
      continue;
    }
    const { identifiers } = await manager.insert(WorkLogEntity, {
      userId: timer.userId,
      todoId: timer.todoId,
      occurrenceId: timer.occurrenceId,
      title: timer.title,
      startedAt: operation.startedAt,
      endedAt: operation.endedAt,
      source: 'timer',
    });
    if (operation.isBlockLog)
      state.workLogId = (identifiers[0] as { id: number }).id;
  }
  Object.assign(timer, state);
  if (type !== 'resume')
    await focusBlockFollowsStopwatch(manager, timer.userId, type, at);
}

function stopwatchState(timer: TimerEntity): StopwatchState {
  return {
    state: timer.state,
    elapsedMilliseconds: timer.elapsedMilliseconds,
    idleMilliseconds: timer.idleMilliseconds ?? 0,
    segmentStartedAt: timer.segmentStartedAt,
    blockStartedAt: timer.blockStartedAt,
    pausedAt: timer.pausedAt,
    workLogId: timer.workLogId,
  };
}

/**
 * The time already logged for a target, overlaps counted once: where a new
 * stopwatch on it starts counting.
 */
export async function loggedMilliseconds(
  manager: EntityManager,
  userId: string,
  target: { todoId: number } | { occurrenceId: number },
): Promise<number> {
  const logs = await manager.find(WorkLogEntity, {
    select: { startedAt: true, endedAt: true },
    where: { userId, ...target },
  });
  return coveredMilliseconds(logs);
}

/**
 * Ends a stopwatch for good: its work stays on record, its row stops
 * counting, and a Fokus-Sperre bound to it ends with it.
 */
export async function stopTimer(
  manager: EntityManager,
  timer: TimerEntity,
  at: Date,
): Promise<TimerEntity> {
  await recordTransition(manager, timer, 'stop', at);
  timer.targetReachesAt = null;
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
