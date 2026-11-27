import { dayOf } from '../../common/date/local-day';
import { occurrenceDueDate } from '../../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus as Status } from '../../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitScheduleVersionEntity } from '../entities/habit-schedule-version.entity';
import { activeVersion } from './occurrence-lifecycle';
import { expiresAt } from './schedule-rules';

/** Why a run may not be acted on now, in the order the rule checks. */
export type RunRefusal =
  /** Its habit is paused. */
  | 'paused'
  /** It is resolved (or cancelled) already. */
  | 'resolved'
  /** Its schedule version is not the one in force now. */
  | 'other_version'
  /** It was moved to a later day. */
  | 'moved_ahead'
  /** Its window closed. */
  | 'ran_out';

/** What the rule reads: plain values, no database. */
export type RunAtHand = {
  run: {
    status: Status;
    scheduledDate: string;
    movedToDate?: string | null;
  };
  /** The run's own schedule version; undefined when it is unknown. */
  version: HabitScheduleVersionEntity | undefined;
  /** The run's habit; may be left out only with `ignorePause`. */
  habit?: { isActive: boolean };
  now: Date;
};

/** Where a caller asks less than the full rule. */
export type RunRuleOptions = {
  /** A completed or skipped run counts too, so it can be reopened. */
  resolved?: boolean;
  /** A run moved to a later day counts too (it may move again). */
  movedAhead?: boolean;
  /** A run of any schedule version not cancelled counts, not only of the one in force. */
  anyVersion?: boolean;
  /** The habit's pause is not looked at. */
  ignorePause?: boolean;
};

/**
 * May this run be acted on now (done, skipped, reopened, moved, timed)?
 * Only an open run of an active habit, of the schedule version in force,
 * due by today (not moved to a later day) and whose window has not closed
 * (`expiresAt`). Returns null when it may, else the first reason it may
 * not. Status changes, moves, the stopwatch, the Monats-Challenge and the
 * calendar export all ask this; `options` names what a caller leaves out.
 */
export function runRefusal(
  { run, version, habit, now }: RunAtHand,
  options: RunRuleOptions = {},
): RunRefusal | null {
  if (!options.ignorePause && !habit?.isActive) return 'paused';
  const open =
    run.status === Status.PENDING ||
    (options.resolved === true &&
      (run.status === Status.COMPLETED || run.status === Status.SKIPPED));
  if (!open) return 'resolved';
  if (
    !version ||
    version.cancelledAt !== null ||
    (!options.anyVersion && activeVersion([version], now) === undefined)
  )
    return 'other_version';
  if (!options.movedAhead && occurrenceDueDate(run) > dayOf(now))
    return 'moved_ahead';
  if (expiresAt(version, run.scheduledDate) <= now) return 'ran_out';
  return null;
}
