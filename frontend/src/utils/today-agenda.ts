import type { DayPlannerItem, DayPlannerResponse } from "../types/day-planner";

export type ExternalEvent = DayPlannerResponse["externalEvents"][number];

/** One row of the day's appointments: a timed item or a calendar event. */
export type TimelineEntry =
  | { kind: "item"; minutes: number; time: string; item: DayPlannerItem }
  | { kind: "event"; minutes: number; time: string; event: ExternalEvent };

export type TodayAgenda = {
  /** The one thing that is up now, shown large with its why. */
  focus: DayPlannerItem | null;
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
  done: number;
  total: number;
};

/** How long an appointment without a duration counts as running. */
const DEFAULT_APPOINTMENT_MINUTES = 30;

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

  // An appointment that is running now comes before the order of the day.
  const running = timed.find(
    ({ item, clock }) =>
      clock.minutes <= now &&
      now <
        clock.minutes +
          (item.plannedDurationMinutes ?? DEFAULT_APPOINTMENT_MINUTES),
  );
  const upcoming = timed.find(({ clock }) => clock.minutes > now);
  const focus =
    running?.item ??
    queue[0] ??
    upcoming?.item ??
    timed.at(-1)?.item ??
    null;

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
    carriedOver,
    timeline,
    nowIndex: nowIndex === -1 ? timeline.length : nowIndex,
    queue,
    resolved,
    done: resolved.length,
    total: today.length,
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
