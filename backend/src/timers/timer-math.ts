/**
 * Stopwatch arithmetic. Everything is derived from stored instants, never
 * from a counter that ticks, so a locked phone or a restarted server cannot
 * make the time drift.
 */
export type Stopwatch = {
  state: 'running' | 'paused' | 'stopped';
  /**
   * The base the stopwatch counts on from, not the sum of its logs: what it
   * started with plus each logged block (short pauses included); once a
   * block is over it becomes the shown time instead, pauses left out and an
   * unlogged short stretch kept (`transition` in `timer-transition.ts`).
   */
  elapsedMilliseconds: number;
  segmentStartedAt: Date | null;
  targetMinutes: number | null;
  /** Short pauses inside the current block, counted by its log only. */
  idleMilliseconds?: number;
  /** While paused: the last block, and its log once it has one. */
  blockStartedAt?: Date | null;
  pausedAt?: Date | null;
  workLogId?: number | null;
};

/** What the shown time is derived from; the target plays no part in it. */
export type StopwatchTime = Omit<Stopwatch, 'targetMinutes'>;

const MINUTE_MS = 60_000;

/**
 * A stretch nobody ended is cut here: a stopwatch forgotten overnight must
 * not turn into hours of work that never happened.
 */
export const MAX_SEGMENT_MS = 12 * 60 * MINUTE_MS;

/**
 * Time worked so far, as the stopwatch shows it: only while it ran. A pause
 * never counts and a short stretch never vanishes from view, so the shown
 * time neither jumps ahead on resume nor back on pause, even though the
 * work log joins short pauses into one block and leaves out a block under a
 * minute (`timer-transition.ts`).
 */
export function elapsedAt(timer: StopwatchTime, now: Date): number {
  const idle = timer.idleMilliseconds ?? 0;
  if (timer.state === 'running' && timer.segmentStartedAt)
    return Math.max(
      0,
      timer.elapsedMilliseconds +
        Math.max(0, now.getTime() - timer.segmentStartedAt.getTime()) -
        idle,
    );
  if (timer.state === 'paused')
    return Math.max(0, timer.elapsedMilliseconds + unloggedBlock(timer) - idle);
  return timer.elapsedMilliseconds;
}

/** While paused: the last block when it is too short to be logged yet. */
export function unloggedBlock(timer: StopwatchTime): number {
  const { blockStartedAt, pausedAt, workLogId } = timer;
  if (workLogId != null || !blockStartedAt || !pausedAt) return 0;
  return Math.max(0, pausedAt.getTime() - blockStartedAt.getTime());
}

/**
 * When a running stopwatch reaches its target, counted from the start of its
 * running stretch. Null without a target, while paused, or once it is reached.
 */
export function targetReachesAt(timer: Stopwatch): Date | null {
  if (
    timer.state !== 'running' ||
    !timer.segmentStartedAt ||
    timer.targetMinutes === null
  )
    return null;
  const idle = timer.idleMilliseconds ?? 0;
  const left =
    timer.targetMinutes * MINUTE_MS - (timer.elapsedMilliseconds - idle);
  return left > 0 ? new Date(timer.segmentStartedAt.getTime() + left) : null;
}

/** Whether the time worked up to `now` has reached the target. */
export function hasReachedTarget(timer: Stopwatch, now: Date): boolean {
  return (
    timer.targetMinutes !== null &&
    elapsedAt(timer, now) >= timer.targetMinutes * MINUTE_MS
  );
}

/** Where a running stretch is cut if nobody ended it; null while it may run. */
export function forgottenSince(timer: Stopwatch, now: Date): Date | null {
  if (timer.state !== 'running' || !timer.segmentStartedAt) return null;
  const limit = timer.segmentStartedAt.getTime() + MAX_SEGMENT_MS;
  return now.getTime() >= limit ? new Date(limit) : null;
}
