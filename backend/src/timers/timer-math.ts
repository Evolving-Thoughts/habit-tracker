/**
 * Stopwatch arithmetic. Everything is derived from stored instants, never
 * from a counter that ticks, so a locked phone or a restarted server cannot
 * make the time drift.
 */
export type Stopwatch = {
  state: 'running' | 'paused' | 'stopped';
  elapsedMilliseconds: number;
  segmentStartedAt: Date | null;
  targetMinutes: number | null;
};

const MINUTE_MS = 60_000;

/**
 * A stretch nobody ended is cut here: a stopwatch forgotten overnight must
 * not turn into hours of work that never happened.
 */
export const MAX_SEGMENT_MS = 12 * 60 * MINUTE_MS;

/** Time worked so far: the finished stretches plus the running one. */
export function elapsedAt(timer: Stopwatch, now: Date): number {
  const running =
    timer.state === 'running' && timer.segmentStartedAt
      ? Math.max(0, now.getTime() - timer.segmentStartedAt.getTime())
      : 0;
  return timer.elapsedMilliseconds + running;
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
  const left = timer.targetMinutes * MINUTE_MS - timer.elapsedMilliseconds;
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
