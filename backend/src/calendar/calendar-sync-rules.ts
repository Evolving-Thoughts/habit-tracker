import { DEFAULT_TIME_ZONE } from '../common/date/date-only.utils';
import {
  addDays,
  atTimeOfDay,
  dayOf,
  startOfDay,
  timeOfDayOf,
} from '../common/date/local-day';
import {
  effectiveDuration,
  HabitOccurrenceEntity,
  occurrenceDueDate,
} from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitEntity } from '../habits/entities/habit.entity';
import { HabitScheduleVersionEntity } from '../habits/entities/habit-schedule-version.entity';
import { runRefusal } from '../habits/scheduling/run-actionability';
import { TodoEntity } from '../todos/entities/todo.entity';
import type { Campaign } from '../todos/todo-ancestry';
import { CampaignLog } from '../work-logs/day-logs';
import { WorkLogEntity } from '../work-logs/work-log.entity';
import { CalendarLinkEntity } from './calendar.entities';
import { GoogleEvent, GoogleEventInput } from './google-calendar.client';

/**
 * The decisions of the Google calendar sync, without database, client or
 * clock: given what is stored and what Google reports, what to change here
 * and what to send to the app's own calendar. `CalendarSyncService` loads
 * the inputs and carries the answers out.
 */

const HORIZON_DAYS = 60;
const DEFAULT_MINUTES = 30;
const MINUTE_MS = 60_000;
const MARKER = 'habitTracker';
/** Shorter stretches stay out of the calendar; they would only clutter it. */
const LOGBOOK_MIN_MS = 5 * MINUTE_MS;
/**
 * New stretches are exported back this far, so connecting a calendar does
 * not write the whole history at once. Linked ones are kept up to date.
 */
const LOGBOOK_PAST_DAYS = 31;

/** What the rules read of a link. */
export type SyncLink = Pick<
  CalendarLinkEntity,
  | 'todoId'
  | 'occurrenceId'
  | 'workLogId'
  | 'remoteUpdatedAt'
  | 'syncedAt'
  | 'suppressed'
>;
export type SyncTodo = Pick<
  TodoEntity,
  | 'id'
  | 'title'
  | 'scheduledDate'
  | 'timeOfDay'
  | 'plannedDurationMinutes'
  | 'completedAt'
  | 'deletedAt'
  | 'updatedAt'
>;
export type SyncRun = Pick<
  HabitOccurrenceEntity,
  | 'id'
  | 'status'
  | 'scheduledDate'
  | 'movedToDate'
  | 'plannedDurationMinutes'
  | 'updatedAt'
> & {
  habit: Pick<
    HabitEntity,
    'title' | 'isActive' | 'timeOfDay' | 'plannedDurationMinutes' | 'updatedAt'
  >;
};
/** A run that may get a new event; its version decides whether it is due. */
export type SyncCandidateRun = SyncRun & {
  scheduleVersion: HabitScheduleVersionEntity;
};
export type SyncLog = Pick<
  WorkLogEntity,
  'id' | 'startedAt' | 'endedAt' | 'updatedAt'
>;

type Local = {
  todoId: number | null;
  occurrenceId: number | null;
  workLogId: number | null;
};
type Change = { input: GoogleEventInput; localUpdatedAt: Date };
/** One request to the app's own calendar, in the order it is sent. */
export type PushOperation<L> =
  | ({ type: 'insert'; local: Local } & Change)
  | ({ type: 'patch'; link: L } & Change)
  | { type: 'delete'; link: L };
/** Links to drop here (no call to Google) and requests to send. */
export type OutgoingPlan<L> = { unlink: L[]; push: PushOperation<L>[] };

/** The last day the sync reads and writes, counted from today. */
export const lastSyncedDay = (today: string): string =>
  addDays(today, HORIZON_DAYS);

/** Work logs that ended from this moment on may get a new event. */
export const logbookSince = (today: string): Date =>
  startOfDay(addDays(today, -LOGBOOK_PAST_DAYS));

const newest = (...dates: Date[]): Date =>
  new Date(Math.max(...dates.map((date) => date.getTime())));

const minutesAfter = (start: Date, minutes: number): Date =>
  new Date(start.getTime() + minutes * MINUTE_MS);

function eventInput(
  summary: string,
  start: Date,
  end: Date,
  description?: string,
): GoogleEventInput {
  return {
    summary,
    ...(description ? { description } : {}),
    start: { dateTime: start.toISOString(), timeZone: DEFAULT_TIME_ZONE },
    end: { dateTime: end.toISOString(), timeZone: DEFAULT_TIME_ZONE },
    extendedProperties: { private: { [MARKER]: 'true' } },
  };
}

/** Start and length of a timed event; all-day events have none. */
function eventTimes(
  event: GoogleEvent,
): { start: Date; end: Date; minutes: number } | null {
  if (!event.start?.dateTime || !event.end?.dateTime) return null;
  const start = new Date(event.start.dateTime);
  const end = new Date(event.end.dateTime);
  const minutes = Math.round((end.getTime() - start.getTime()) / MINUTE_MS);
  return { start, end, minutes };
}

/**
 * The times of an event someone planned in Google: not cancelled, not
 * all-day, and not written by the app (its private marker). Only such an
 * event becomes an appointment or is shown from a read calendar.
 */
export function plannedTimes(
  event: GoogleEvent,
): { start: Date; end: Date; minutes: number } | null {
  const times = eventTimes(event);
  if (
    event.status === 'cancelled' ||
    !times ||
    event.extendedProperties?.private?.[MARKER]
  )
    return null;
  return times;
}

/** What an event sets on its quest. */
export type Appointment = {
  title: string;
  scheduledDate: string;
  timeOfDay: string;
  plannedDurationMinutes: number;
};

/**
 * A new event of the user's becomes an appointment on its Berlin day and
 * time, titled "Termin" when it has no title.
 */
function appointmentOf(event: GoogleEvent): Appointment | null {
  const times = plannedTimes(event);
  if (!times) return null;
  return {
    title: (event.summary?.trim() || 'Termin').slice(0, 200),
    scheduledDate: dayOf(times.start),
    timeOfDay: timeOfDayOf(times.start),
    plannedDurationMinutes: times.minutes,
  };
}

/** What one event of the own calendar asks for here. */
export type IncomingStep =
  | { kind: 'none' }
  | { kind: 'adopt'; appointment: Appointment }
  | { kind: 'deleted' }
  | { kind: 'editTodo' }
  /** `day` is null for an event without times: the run is not moved. */
  | { kind: 'moveRun'; day: string | null };

/**
 * An unknown event becomes an appointment (if planned by the user); a
 * cancelled one is a deletion. A Logbuch event only reports measured work:
 * an edit in Google neither changes the log nor turns it into a plan. An
 * edit newer than the last one seen goes to the quest or the run.
 */
export function incomingStep(
  link: SyncLink | undefined,
  event: GoogleEvent,
): IncomingStep {
  if (!link) {
    const appointment = appointmentOf(event);
    return appointment ? { kind: 'adopt', appointment } : { kind: 'none' };
  }
  if (event.status === 'cancelled') return { kind: 'deleted' };
  const edited = new Date(event.updated) > link.remoteUpdatedAt;
  if (link.workLogId !== null || !edited) return { kind: 'none' };
  if (link.todoId !== null) return { kind: 'editTodo' };
  const times = eventTimes(event);
  return { kind: 'moveRun', day: times ? dayOf(times.start) : null };
}

/**
 * The newer side wins: a quest changed here after the last exchange and
 * after the event keeps its own state (the outgoing phase sends it). A
 * completed quest and an all-day event change nothing. The title falls back
 * to the quest's own.
 */
export function eventEdit(
  todo: Pick<SyncTodo, 'title' | 'completedAt' | 'updatedAt'>,
  link: Pick<SyncLink, 'syncedAt'>,
  event: GoogleEvent,
): Appointment | null {
  const times = eventTimes(event);
  const localWins =
    todo.updatedAt > link.syncedAt && todo.updatedAt > new Date(event.updated);
  if (!times || todo.completedAt || localWins) return null;
  return {
    title: (event.summary?.trim() || todo.title).slice(0, 200),
    scheduledDate: dayOf(times.start),
    timeOfDay: timeOfDayOf(times.start),
    plannedDurationMinutes: times.minutes,
  };
}

function todoChange(todo: SyncTodo): Change {
  const start = atTimeOfDay(todo.scheduledDate!, todo.timeOfDay!);
  return {
    input: eventInput(
      todo.title,
      start,
      minutesAfter(start, todo.plannedDurationMinutes ?? DEFAULT_MINUTES),
    ),
    localUpdatedAt: todo.updatedAt,
  };
}

/**
 * Only an appointment has an event: a quest that is gone or lost its day or
 * time loses it, a completed one keeps it but drops the link, a changed one
 * patches it. `open` are the open appointments within `lastSyncedDay`
 * (filtered by the query); each without a link gets a new event.
 */
export function todoPushes<L extends SyncLink>(
  links: L[],
  known: SyncTodo[],
  open: SyncTodo[],
): OutgoingPlan<L> {
  const linked = links.filter((link) => link.todoId !== null);
  const plan: OutgoingPlan<L> = { unlink: [], push: [] };
  for (const link of linked) {
    const todo = known.find((item) => item.id === link.todoId);
    if (!todo || todo.deletedAt || !todo.scheduledDate || !todo.timeOfDay)
      plan.push.push({ type: 'delete', link });
    else if (todo.completedAt) plan.unlink.push(link);
    else if (todo.updatedAt > link.syncedAt)
      plan.push.push({ type: 'patch', link, ...todoChange(todo) });
  }
  const taken = new Set(linked.map((link) => link.todoId));
  for (const todo of open)
    if (!taken.has(todo.id))
      plan.push.push({
        type: 'insert',
        local: { todoId: todo.id, occurrenceId: null, workLogId: null },
        ...todoChange(todo),
      });
  return plan;
}

/** A run's event: its due day at the habit's time, changed by either. */
function runChange(run: SyncRun): Change {
  const start = atTimeOfDay(occurrenceDueDate(run), run.habit.timeOfDay!);
  return {
    input: eventInput(
      run.habit.title,
      start,
      minutesAfter(start, effectiveDuration(run, run.habit) ?? DEFAULT_MINUTES),
    ),
    localUpdatedAt: newest(run.updatedAt, run.habit.updatedAt),
  };
}

/**
 * A completed run keeps its event but drops the link. A link deleted in
 * Google (suppressed) is never written again and goes once the run is no
 * longer open. A run that is no longer open, or whose habit is paused or
 * lost its time, loses its event; a changed one patches it. A new event
 * goes to every open run with a time, due from today to `lastSyncedDay`,
 * that `runRefusal` allows; runs are not brought up to now here: any
 * version still counts, and so does a run moved to a later day.
 */
export function runPushes<L extends SyncLink>(
  links: L[],
  known: SyncRun[],
  open: SyncCandidateRun[],
  today: string,
  now: Date,
): OutgoingPlan<L> {
  const linked = links.filter((link) => link.occurrenceId !== null);
  const plan: OutgoingPlan<L> = { unlink: [], push: [] };
  for (const link of linked) {
    const run = known.find((item) => item.id === link.occurrenceId);
    const isOpen = run?.status === HabitOccurrenceStatus.PENDING;
    const planned = isOpen && run.habit.isActive && run.habit.timeOfDay;
    if (run?.status === HabitOccurrenceStatus.COMPLETED) plan.unlink.push(link);
    else if (link.suppressed) {
      if (!isOpen) plan.unlink.push(link);
    } else if (!planned) plan.push.push({ type: 'delete', link });
    else {
      const change = runChange(run);
      if (change.localUpdatedAt > link.syncedAt)
        plan.push.push({ type: 'patch', link, ...change });
    }
  }
  const taken = new Set(linked.map((link) => link.occurrenceId));
  const lastDay = lastSyncedDay(today);
  for (const run of open) {
    const due = occurrenceDueDate(run);
    if (
      !taken.has(run.id) &&
      run.habit.timeOfDay &&
      due >= today &&
      due <= lastDay &&
      runRefusal(
        { run, version: run.scheduleVersion, habit: run.habit, now },
        { movedAhead: true, anyVersion: true },
      ) === null
    )
      plan.push.push({
        type: 'insert',
        local: { todoId: null, occurrenceId: run.id, workLogId: null },
        ...runChange(run),
      });
  }
  return plan;
}

/** Only a finished stretch of at least five minutes has an event. */
const exported = (log: SyncLog): boolean =>
  log.endedAt.getTime() - log.startedAt.getTime() >= LOGBOOK_MIN_MS;

/** The Logbuch decisions before the stretches are described. */
export type LogSteps<L, W> = OutgoingPlan<L> & {
  patched: { link: L; log: W }[];
  fresh: W[];
};

/**
 * The Logbuch only goes out. A deleted log loses its event; a corrected one
 * (moved, lengthened or shortened, later `updatedAt`) patches it. An event
 * deleted in Google stays deleted: its suppressed link stays until the log
 * goes. `recent` are the logs ended since `logbookSince`; each of five
 * minutes or more without a link gets a new event. `push` holds the
 * deletions; `patched` and `fresh` still need their description.
 */
export function logSteps<L extends SyncLink, W extends SyncLog>(
  links: L[],
  known: W[],
  recent: W[],
): LogSteps<L, W> {
  const linked = links.filter((link) => link.workLogId !== null);
  const taken = new Set(linked.map((link) => link.workLogId));
  const steps: LogSteps<L, W> = {
    unlink: [],
    push: [],
    patched: [],
    fresh: recent.filter((log) => !taken.has(log.id) && exported(log)),
  };
  for (const link of linked) {
    const log = known.find((item) => item.id === link.workLogId);
    if (link.suppressed) {
      if (!log) steps.unlink.push(link);
    } else if (!log) steps.push.push({ type: 'delete', link });
    else if (log.updatedAt > link.syncedAt) steps.patched.push({ link, log });
  }
  return steps;
}

/** A stretch with its title and the campaign it worked towards. */
export type DescribedLog = Pick<
  CampaignLog,
  'id' | 'title' | 'startedAt' | 'endedAt' | 'updatedAt'
> & { campaign: Pick<Campaign, 'title'> | null };

/** Named as Logbuch in Google, so it never reads as a plan. */
function logChange(log: DescribedLog): Change {
  const description = [
    'Logbuch · gemessene Arbeitszeit',
    ...(log.campaign ? [`Kampagne: ${log.campaign.title}`] : []),
  ].join('\n');
  return {
    input: eventInput(log.title, log.startedAt, log.endedAt, description),
    localUpdatedAt: log.updatedAt,
  };
}

/**
 * The Logbuch requests in order: deletions, then patches, then new events,
 * each with its stretch as described (title and campaign).
 */
export function logPushes<L>(
  steps: LogSteps<L, SyncLog>,
  described: DescribedLog[],
): PushOperation<L>[] {
  const change = (id: number): Change =>
    logChange(described.find((log) => log.id === id)!);
  return [
    ...steps.push,
    ...steps.patched.map(({ link, log }): PushOperation<L> => ({
      type: 'patch',
      link,
      ...change(log.id),
    })),
    ...steps.fresh.map((log): PushOperation<L> => ({
      type: 'insert',
      local: { todoId: null, occurrenceId: null, workLogId: log.id },
      ...change(log.id),
    })),
  ];
}
