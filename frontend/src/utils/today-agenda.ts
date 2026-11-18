import type { DayPlannerItem, DayPlannerResponse } from "../types/day-planner";
import { tallyOfPlanner, type DayTally } from "./day-tally";

export type ExternalEvent = DayPlannerResponse["externalEvents"][number];

/** One row of the day's appointments: a timed item or a calendar event. */
export type TimelineEntry =
  | { kind: "item"; minutes: number; time: string; item: DayPlannerItem }
  | { kind: "event"; minutes: number; time: string; event: ExternalEvent };

export type TodayAgenda = {
  /** The one thing that is up now (`currentItem`), shown large with its why. */
  focus: DayPlannerItem | null;
  /** Start and end of the focus when it is an appointment whose turn it is. */
  focusWindow: AppointmentWindow | null;
  /** Open items from earlier days, offered for catching up. */
  carriedOver: DayPlannerItem[];
  /** Today's appointments, timed dailies and events by clock, without the focus. */
  timeline: TimelineEntry[];
  /** Index in `timeline` where "now" falls. */
  nowIndex: number;
  /**
   * Everything open that only has its day, in the order of the day. Its first
   * entry is the focus unless an appointment is running right now.
   */
  queue: DayPlannerItem[];
  resolved: DayPlannerItem[];
  /** The day counted by the rule all views share (`day-tally.ts`). */
  tally: DayTally;
};

/**
 * How long an appointment without a planned duration stays its turn: long
 * enough for a short call, short enough not to hold the focus card all
 * morning when nobody set a duration.
 */
export const DEFAULT_APPOINTMENT_MINUTES = 30;

/** Minutes since midnight: an appointment's turn, from start until end. */
export type AppointmentWindow = { start: number; end: number };

const timeFormat = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

function clockOf(instant: string): { minutes: number; time: string } {
  const time = timeFormat.format(new Date(instant));
  const [hours, minutes] = time.split(":").map(Number);
  return { minutes: hours! * 60 + minutes!, time };
}

/** The clock time an appointment or timed daily is fixed to, if it has one. */
export function plannedClock(
  item: DayPlannerItem,
): { minutes: number; time: string } | null {
  if (!item.timeOfDay) return null;
  const [hours, minutes] = item.timeOfDay.split(":").map(Number);
  return {
    minutes: hours! * 60 + minutes!,
    time: item.timeOfDay.slice(0, 5),
  };
}

/** A stable key of an item, also what the order of the day is stored by. */
export function itemKey(item: DayPlannerItem): string {
  return item.type === "todo"
    ? `todo-${item.todoId}`
    : `habit-${item.occurrenceId}`;
}

/** When an appointment or timed daily is its turn; null without a time. */
export function appointmentWindow(
  item: DayPlannerItem,
): AppointmentWindow | null {
  const clock = plannedClock(item);
  if (!clock) return null;
  return {
    start: clock.minutes,
    end:
      clock.minutes +
      (item.plannedDurationMinutes ?? DEFAULT_APPOINTMENT_MINUTES),
  };
}

/** "09:00–10:00" for a window, in minutes since midnight. */
export function formatWindow(window: AppointmentWindow): string {
  const clock = (minutes: number) => {
    const wrapped = ((minutes % 1440) + 1440) % 1440;
    return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
  };
  return `${clock(window.start)}–${clock(window.end)}`;
}

/**
 * What is up now: the one rule Heute's focus card and the Fokus-Modus share.
 * An appointment is up from its start until its end (start plus its planned
 * duration, or DEFAULT_APPOINTMENT_MINUTES); when several are, the one that
 * began last. Otherwise it is the head of the order: the next item one can
 * work on. Before its start and after its end an appointment stays on the
 * time axis; it never stands in for an empty order.
 */
export function currentItem(
  pending: readonly DayPlannerItem[],
  queue: readonly DayPlannerItem[],
  now: number,
): DayPlannerItem | null {
  let running: { item: DayPlannerItem; start: number } | null = null;
  for (const item of pending) {
    const window = appointmentWindow(item);
    if (!window || window.start > now || now >= window.end) continue;
    if (!running || window.start > running.start)
      running = { item, start: window.start };
  }
  return running?.item ?? queue[0] ?? null;
}

/**
 * The next minute at which `currentItem` or the "now" line can change: an
 * appointment starts or ends, or an entry of the axis falls behind "now".
 * Null when nothing changes any more today. A timer waits for exactly this
 * instead of polling the clock.
 */
export function nextChangeAt(
  planner: DayPlannerResponse,
  now: number,
): number | null {
  const moments: number[] = [];
  for (const item of planner.items) {
    if (item.status !== "pending" || item.isOverdue) continue;
    const window = appointmentWindow(item);
    if (window) moments.push(window.start, window.start + 1, window.end);
  }
  for (const event of planner.externalEvents) {
    const { minutes } = clockOf(event.start);
    moments.push(minutes + 1);
  }
  const later = moments.filter((moment) => moment > now && moment < 1440);
  return later.length ? Math.min(...later) : null;
}

/** Arranges today around what is up now. `now` is minutes since midnight. */
export function arrangeToday(
  planner: DayPlannerResponse,
  now: number,
): TodayAgenda {
  const carriedOver = planner.items.filter(
    (item) => item.isOverdue && item.status === "pending",
  );
  const today = planner.items.filter((item) => !item.isOverdue);
  const pending = today.filter((item) => item.status === "pending");
  const resolved = today.filter((item) => item.status !== "pending");

  const timed = pending
    .flatMap((item) => {
      const clock = plannedClock(item);
      return clock ? [{ item, clock }] : [];
    })
    .sort((first, second) => first.clock.minutes - second.clock.minutes);
  const queue = pending.filter((item) => plannedClock(item) === null);
  const focus = currentItem(pending, queue, now);

  const events: TimelineEntry[] = planner.externalEvents.map((event) => ({
    kind: "event",
    ...clockOf(event.start),
    event,
  }));
  const items: TimelineEntry[] = timed
    .filter(({ item }) => item !== focus)
    .map(({ item, clock }) => ({ kind: "item", ...clock, item }));
  const timeline = [...items, ...events].sort(
    (first, second) => first.minutes - second.minutes,
  );
  const nowIndex = timeline.findIndex((entry) => entry.minutes >= now);

  return {
    focus,
    focusWindow: focus ? appointmentWindow(focus) : null,
    carriedOver,
    timeline,
    nowIndex: nowIndex === -1 ? timeline.length : nowIndex,
    queue,
    resolved,
    tally: tallyOfPlanner(planner.items),
  };
}

/** `list` with the entry at `from` moved to `to`; out-of-range moves change nothing. */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const result = [...list];
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= result.length ||
    to >= result.length
  )
    return result;
  const [entry] = result.splice(from, 1);
  result.splice(to, 0, entry!);
  return result;
}

/**
 * The planner with its queue in a new order. Everything that is not part of
 * `queue` keeps its place, so the result reads like the server's answer.
 */
export function withQueueOrder(
  planner: DayPlannerResponse,
  queue: readonly DayPlannerItem[],
): DayPlannerResponse {
  const keys = new Set(queue.map(itemKey));
  const next = [...queue];
  return {
    ...planner,
    items: planner.items.map((item) =>
      keys.has(itemKey(item)) ? next.shift()! : item,
    ),
  };
}

/** "Donnerstag, 12. Nov." for an ISO day. */
export function formatDayHeading(date: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

/** "1 Std. 10 Min." or "25 Min." */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} Min.`;
  return rest ? `${hours} Std. ${rest} Min.` : `${hours} Std.`;
}

export function nowInBerlin(date = new Date()): number {
  return clockOf(date.toISOString()).minutes;
}
