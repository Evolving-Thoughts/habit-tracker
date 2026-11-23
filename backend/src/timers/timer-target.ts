import { Brackets, EntityManager, LessThan } from 'typeorm';
import { occurrenceDueDate } from '../habit-occurrences/entities/habit-occurrence.entity';
import { WorkLogEntity } from '../work-logs/work-log.entity';
import { coveredMilliseconds } from '../work-logs/work-time';
import { elapsedAt, MAX_SEGMENT_MS } from './timer-math';
import { TimerEntity } from './timer.entity';

/**
 * Timer targets: which todo or habit occurrence may carry a stopwatch, what
 * its planned minutes are, and what happens to a stopwatch when its target
 * stops being eligible. Pure rules plus one write; no Nest dependencies, so todos,
 * habits, day planner and history can all use it without module cycles.
 */
export const TIMER_MIN_MINUTES = 1;
export const TIMER_MAX_MINUTES = 10080;

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

/**
 * A pause shorter than this is part of the block: resuming within it
 * continues the block before the pause, and its log counts the pause as
 * worked (the shown time leaves it out, `idleMilliseconds`).
 */
export const BLOCK_GAP_MS = 60_000;
/**
 * A block shorter than this is not logged while it may still be a mis-tap:
 * the stopwatch shows its time (`unloggedBlock`), and the block gets its log
 * once work resumes after the gap (`resumeWorkSegment`). Ended right away,
 * it stays unlogged.
 */
export const MIN_BLOCK_MS = 60_000;

/**
 * Ends the running stretch of a stopwatch at `end`. The work log of its
 * block is extended when the stretch continues one, else a block of at
 * least `MIN_BLOCK_MS` becomes a new work log and a shorter one is dropped.
 * The time of a logged block joins what was worked before. The caller sets
 * the new state.
 */
export async function closeWorkSegment(
  manager: EntityManager,
  timer: TimerEntity,
  end: Date,
): Promise<void> {
  const startedAt = timer.segmentStartedAt;
  timer.segmentStartedAt = null;
  if (!startedAt) return;
  // A stretch nobody ended never counts for more than its limit.
  const endedAt = new Date(
    Math.max(
      startedAt.getTime(),
      Math.min(end.getTime(), startedAt.getTime() + MAX_SEGMENT_MS),
    ),
  );
  const length = endedAt.getTime() - startedAt.getTime();
  timer.blockStartedAt = startedAt;
  timer.pausedAt = endedAt;
  if (timer.workLogId !== null) {
    // The log may have been corrected or deleted meanwhile: then start anew.
    const { affected } = await manager.update(
      WorkLogEntity,
      {
        id: timer.workLogId,
        userId: timer.userId,
        startedAt: LessThan(endedAt),
      },
      { endedAt },
    );
    if (affected) {
      timer.elapsedMilliseconds += length;
      return;
    }
    timer.workLogId = null;
  }
  if (length < MIN_BLOCK_MS) return;
  const { identifiers } = await manager.insert(WorkLogEntity, {
    userId: timer.userId,
    todoId: timer.todoId,
    occurrenceId: timer.occurrenceId,
    title: timer.title,
    startedAt,
    endedAt,
    source: 'timer',
  });
  timer.workLogId = (identifiers[0] as { id: number }).id;
  timer.elapsedMilliseconds += length;
}

/**
 * Starts the next stretch of a paused stopwatch at `now`. Within
 * `BLOCK_GAP_MS` of the pause it continues the block before it: the stretch
 * starts where that block started, so the block's log counts the pause as
 * worked and is extended when it ends; the shown time leaves the pause out.
 * Otherwise a new block begins, and a block before it that was too short
 * for a log gets one now: work resumed later was work, not a mis-tap. The
 * caller sets the target moment.
 */
export async function resumeWorkSegment(
  manager: EntityManager,
  timer: TimerEntity,
  now: Date,
): Promise<void> {
  const { blockStartedAt, pausedAt } = timer;
  const gap = pausedAt ? now.getTime() - pausedAt.getTime() : Infinity;
  if (blockStartedAt && pausedAt && gap >= 0 && gap < BLOCK_GAP_MS) {
    // The block is counted again, whole, when this stretch ends.
    if (timer.workLogId !== null)
      timer.elapsedMilliseconds -=
        pausedAt.getTime() - blockStartedAt.getTime();
    // The log counts the pause; the stopwatch does not show it.
    timer.idleMilliseconds = (timer.idleMilliseconds ?? 0) + gap;
    timer.segmentStartedAt = blockStartedAt;
  } else {
    // The block before is over: from here on it counts as it was shown,
    // its pauses left out.
    timer.elapsedMilliseconds = elapsedAt(timer, now);
    if (
      timer.workLogId === null &&
      blockStartedAt &&
      pausedAt &&
      pausedAt > blockStartedAt
    )
      await manager.insert(WorkLogEntity, {
        userId: timer.userId,
        todoId: timer.todoId,
        occurrenceId: timer.occurrenceId,
        title: timer.title,
        startedAt: blockStartedAt,
        endedAt: pausedAt,
        source: 'timer',
      });
    timer.idleMilliseconds = 0;
    timer.workLogId = null;
    timer.segmentStartedAt = now;
  }
  timer.blockStartedAt = null;
  timer.pausedAt = null;
  timer.state = 'running';
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

/** Ends a stopwatch for good: its work stays on record, its row stops counting. */
export async function stopTimer(
  manager: EntityManager,
  timer: TimerEntity,
  at: Date,
): Promise<TimerEntity> {
  await closeWorkSegment(manager, timer, at);
  timer.state = 'stopped';
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
