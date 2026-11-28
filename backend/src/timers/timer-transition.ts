import {
  elapsedAt,
  hasReachedTarget,
  MAX_SEGMENT_MS,
  targetReachesAt,
} from './timer-math';

/**
 * How a stopwatch and the Logbuch move together, as one pure function: the
 * state of the stopwatch, an event and its moment go in, the next state and
 * the work log writes that belong to it come out (`transition`). Nothing
 * here touches the database; `recordTransition` in `timer-target.ts` loads
 * what an event needs, stores the state and runs the log writes.
 *
 * The stopwatch logs **blocks**, not every stretch (`docs/timers-and-completion.md`):
 *
 * - resumed within `BLOCK_GAP_MS` of a pause, the stretch continues the block
 *   before it, so the block's log is extended instead of a second row;
 * - a block shorter than `MIN_BLOCK_MS` gets no log while it may still be a
 *   mis-tap; it gets one once work resumes after the gap, and none when the
 *   stopwatch is ended right away;
 * - what the stopwatch shows is only the time it ran (`elapsedAt`), so the
 *   time neither jumps back on a pause nor ahead on resume.
 *
 * It also keeps the Soll's bookkeeping: when a running stopwatch reaches
 * its target (`targetReachesAt`), when it did (`targetReachedAt`) and
 * whether the push worker has looked at it (`pushHandledAt`).
 */

/**
 * A pause shorter than this is part of the block: resuming within it
 * continues the block before the pause, and its log counts the pause as
 * worked (the shown time leaves it out, `idleMilliseconds`).
 */
export const BLOCK_GAP_MS = 60_000;
/**
 * A block shorter than this is not logged while it may still be a mis-tap:
 * the stopwatch shows its time (`unloggedBlock`), and the block gets its log
 * once work resumes after the gap. Ended right away, it stays unlogged.
 */
export const MIN_BLOCK_MS = 60_000;

/** The fields of a stopwatch that the transition reads and writes. */
export type StopwatchState = {
  state: 'running' | 'paused' | 'stopped';
  /** The base the stopwatch counts on from (see `timer-math.ts`). */
  elapsedMilliseconds: number;
  /** Short pauses inside the current block, counted by its log only. */
  idleMilliseconds: number;
  /** Start of the running stretch; a continued block starts at its start. */
  segmentStartedAt: Date | null;
  /** While paused: the last block. */
  blockStartedAt: Date | null;
  pausedAt: Date | null;
  /** The work log of the current block, once it is long enough to be one. */
  workLogId: number | null;
  /** The Soll in minutes, if the target has one. */
  targetMinutes: number | null;
  /** While running towards the Soll: the moment it is reached. */
  targetReachesAt: Date | null;
  /** When the Soll was reached; the notification hangs on this. */
  targetReachedAt: Date | null;
  /** When the push worker looked at the reached Soll, or set as handled. */
  pushHandledAt: Date | null;
};

export type StopwatchEvent =
  /**
   * Ends the running stretch: `pause` leaves the stopwatch paused, `stop`
   * ends it for good. `blockLog` is the stored log of `workLogId` as it is
   * now, or null when it was deleted meanwhile; it is only read when the
   * stopwatch has a block log.
   */
  | { type: 'pause' | 'stop'; blockLog?: { startedAt: Date } | null }
  /** Starts the next stretch of a paused stopwatch. */
  | { type: 'resume' }
  /** The running stopwatch reached its Soll at the event's moment. */
  | { type: 'reach' }
  /** The Soll is now `minutes`; the time worked stays. */
  | { type: 'changeTarget'; minutes: number }
  /** The push worker looked at the reached Soll; it does not look again. */
  | { type: 'markPushHandled' };

export type LogOperation =
  /** Moves the end of the existing log `id`. */
  | { type: 'extend'; id: number; endedAt: Date }
  /**
   * Writes a new log. With `isBlockLog` it is the log of the current block:
   * the caller stores its id as the next state's `workLogId`.
   */
  | { type: 'insert'; startedAt: Date; endedAt: Date; isBlockLog: boolean };

export type Transition = { state: StopwatchState; logOps: LogOperation[] };

/**
 * The next state of the stopwatch and the log writes for `event` at `now`.
 * An event that does not apply to the state (resuming a running stopwatch,
 * pausing a paused one) changes only `state`, as the callers never send it.
 * The Soll is due only while the stopwatch runs: a pause or stop clears its
 * moment, a resume computes it again unless it was reached already.
 */
export function transition(
  current: StopwatchState,
  event: StopwatchEvent,
  now: Date,
): Transition {
  switch (event.type) {
    case 'resume': {
      const resumed = resume(current, now);
      const { state } = resumed;
      // A block continued past its Soll stays reached; nothing is due again.
      state.targetReachesAt = state.targetReachedAt
        ? null
        : targetReachesAt(state);
      return resumed;
    }
    case 'pause':
    case 'stop': {
      const closed = closeStretch(current, now, event.blockLog ?? null);
      return {
        state: {
          ...closed.state,
          state: event.type === 'pause' ? 'paused' : 'stopped',
          targetReachesAt: null,
        },
        logOps: closed.logOps,
      };
    }
    case 'reach':
      return {
        state: { ...current, targetReachedAt: now, targetReachesAt: null },
        logOps: [],
      };
    case 'changeTarget':
      return {
        state: settleTarget({ ...current, targetMinutes: event.minutes }, now),
        logOps: [],
      };
    case 'markPushHandled':
      return { state: { ...current, pushHandledAt: now }, logOps: [] };
  }
}

/**
 * A new stopwatch, running from `now` on the time already logged for its
 * target. A Soll that this time already passed is reached silently.
 */
export function startedStopwatch(
  loggedMilliseconds: number,
  targetMinutes: number | null,
  now: Date,
): StopwatchState {
  return settleTarget(
    {
      state: 'running',
      elapsedMilliseconds: loggedMilliseconds,
      idleMilliseconds: 0,
      segmentStartedAt: now,
      blockStartedAt: null,
      pausedAt: null,
      workLogId: null,
      targetMinutes,
      targetReachesAt: null,
      targetReachedAt: null,
      pushHandledAt: null,
    },
    now,
  );
}

/**
 * The Soll after it or the time worked was set rather than counted (a
 * start, a new target). Already passed, it is reached without a
 * notification: marked reached and handled at `now`, nobody needs to hear
 * of it, and an earlier reach stays as it was. Otherwise it is due at its
 * moment (none while paused), with nothing reached or handled.
 */
function settleTarget(state: StopwatchState, now: Date): StopwatchState {
  if (!hasReachedTarget(state, now))
    return {
      ...state,
      targetReachesAt: targetReachesAt(state),
      targetReachedAt: null,
      pushHandledAt: null,
    };
  if (state.targetReachedAt) return { ...state, targetReachesAt: null };
  return {
    ...state,
    targetReachesAt: null,
    targetReachedAt: now,
    pushHandledAt: now,
  };
}

/**
 * Ends the running stretch at `end`. The log of its block is extended when
 * the stretch continues one that can still be found (same id, its start
 * before the new end); else a block of at least `MIN_BLOCK_MS` becomes a new
 * log and a shorter one is dropped. The time of a logged block joins what
 * was worked before.
 */
function closeStretch(
  current: StopwatchState,
  end: Date,
  blockLog: { startedAt: Date } | null,
): Transition {
  const state = { ...current, segmentStartedAt: null };
  const startedAt = current.segmentStartedAt;
  if (!startedAt) return { state, logOps: [] };
  // A stretch nobody ended never counts for more than its limit.
  const endedAt = new Date(
    Math.max(
      startedAt.getTime(),
      Math.min(end.getTime(), startedAt.getTime() + MAX_SEGMENT_MS),
    ),
  );
  const length = endedAt.getTime() - startedAt.getTime();
  state.blockStartedAt = startedAt;
  state.pausedAt = endedAt;
  if (state.workLogId !== null) {
    // The log may have been corrected or deleted meanwhile: then start anew.
    if (blockLog && blockLog.startedAt < endedAt) {
      state.elapsedMilliseconds += length;
      return {
        state,
        logOps: [{ type: 'extend', id: state.workLogId, endedAt }],
      };
    }
    state.workLogId = null;
  }
  if (length < MIN_BLOCK_MS) return { state, logOps: [] };
  state.elapsedMilliseconds += length;
  return {
    state,
    logOps: [{ type: 'insert', startedAt, endedAt, isBlockLog: true }],
  };
}

/**
 * Starts the next stretch at `now`. Within `BLOCK_GAP_MS` of the pause it
 * continues the block before it: the stretch starts where that block
 * started, so the block's log counts the pause as worked and is extended
 * when it ends; the shown time leaves the pause out. Otherwise a new block
 * begins, and a block before it that was too short for a log gets one now:
 * work resumed later was work, not a mis-tap.
 */
function resume(current: StopwatchState, now: Date): Transition {
  const { blockStartedAt, pausedAt } = current;
  const state: StopwatchState = {
    ...current,
    blockStartedAt: null,
    pausedAt: null,
    state: 'running',
  };
  const gap = pausedAt ? now.getTime() - pausedAt.getTime() : Infinity;
  if (blockStartedAt && pausedAt && gap >= 0 && gap < BLOCK_GAP_MS) {
    // The block is counted again, whole, when this stretch ends.
    if (current.workLogId !== null)
      state.elapsedMilliseconds -=
        pausedAt.getTime() - blockStartedAt.getTime();
    // The log counts the pause; the stopwatch does not show it.
    state.idleMilliseconds = current.idleMilliseconds + gap;
    state.segmentStartedAt = blockStartedAt;
    return { state, logOps: [] };
  }
  const logOps: LogOperation[] =
    current.workLogId === null &&
    blockStartedAt &&
    pausedAt &&
    pausedAt > blockStartedAt
      ? [
          {
            type: 'insert',
            startedAt: blockStartedAt,
            endedAt: pausedAt,
            isBlockLog: false,
          },
        ]
      : [];
  // The block before is over: from here on it counts as it was shown, its
  // pauses left out.
  state.elapsedMilliseconds = elapsedAt(current, now);
  state.idleMilliseconds = 0;
  state.workLogId = null;
  state.segmentStartedAt = now;
  return { state, logOps };
}
