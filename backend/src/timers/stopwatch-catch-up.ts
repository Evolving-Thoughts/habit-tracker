import { forgottenSince, type Stopwatch } from './timer-math';

/**
 * What a stored stopwatch needs to be brought up to `now`, as one pure
 * decision. `TimersService` asks it on every read of the stopwatch: a read
 * that gets `keep` answers from what is stored, without the user lock;
 * anything else is decided again under the lock and applied there.
 */

/** The stopwatch fields the decision reads. */
export type StoredStopwatch = Stopwatch & {
  title: string;
  targetReachesAt: Date | null;
};

/**
 * The stopwatch's target as it is now: null when it is gone; else whether
 * it may still carry a stopwatch (an open todo, a run `runRefusal` allows)
 * and the title it has now.
 */
export type TargetAtHand = null | { eligible: boolean; title: string };

export type StopwatchCatchUp =
  /** Nothing to store. */
  | { outcome: 'keep' }
  /** The target is gone or may no longer carry a stopwatch: end it now. */
  | { outcome: 'stop' }
  /**
   * One or more of: the target's new title; the moment the Soll was
   * reached (`reachedAt`); where a stretch nobody ended is cut, leaving the
   * stopwatch paused (`cutAt`).
   */
  | { outcome: 'update'; title?: string; reachedAt?: Date; cutAt?: Date };

/**
 * A running or paused stopwatch follows its target: stopped when the target
 * is gone or no longer eligible, retitled when the title changed. A Soll
 * moment passed by `now` is marked reached, but only when it lies before a
 * cut: a stretch that ran twelve hours unattended is cut there
 * (`forgottenSince`), and a Soll after the cut was never reached.
 */
export function stopwatchCatchUp(
  timer: StoredStopwatch,
  target: TargetAtHand,
  now: Date,
): StopwatchCatchUp {
  if (timer.state === 'stopped') return { outcome: 'keep' };
  if (!target?.eligible) return { outcome: 'stop' };
  const change: Omit<
    Extract<StopwatchCatchUp, { outcome: 'update' }>,
    'outcome'
  > = {};
  if (target.title !== timer.title) change.title = target.title;
  const cut = forgottenSince(timer, now);
  if (timer.targetReachesAt && timer.targetReachesAt <= (cut ?? now))
    change.reachedAt = timer.targetReachesAt;
  if (cut) change.cutAt = cut;
  return Object.keys(change).length
    ? { outcome: 'update', ...change }
    : { outcome: 'keep' };
}
