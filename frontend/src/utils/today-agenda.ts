import type { DayPlannerItem, DayPlannerResponse } from "../types/day-planner";
import { anchoredOrder } from "./day-order";
import { tallyOfPlanner, type DayTally } from "./day-tally";

export type ExternalEvent = DayPlannerResponse["externalEvents"][number];

/**
 * An appointment of the day: a timed item or a calendar event, at its start.
 * `past` once it is over: an item after its window, an event after its end.
 */
export type AppointmentEntry =
  | {
      kind: "item";
      minutes: number;
      time: string;
      past: boolean;
      item: DayPlannerItem;
    }
  | {
      kind: "event";
      minutes: number;
      time: string;
      past: boolean;
      event: ExternalEvent;
    };

/**
 * One entry of Heute's list below the focus card: an item that only has its
 * day, or an appointment anchored by its time (`AppointmentEntry`).
 */
export type DayEntry = { kind: "row"; item: DayPlannerItem } | AppointmentEntry;

export type TodayAgenda = {
  /** The one thing that is up now (`currentItem`), shown large with its why. */
  focus: DayPlannerItem | null;
  /** Start and end of the focus when it is an appointment whose turn it is. */
  focusWindow: AppointmentWindow | null;
  /** Open items from earlier days, offered for catching up. */
  carriedOver: DayPlannerItem[];
  /**
   * Today's open appointments, timed dailies and events by clock, without
   * the focus. Heute lists them in the order of the day, anchored by time.
   */
  appointments: AppointmentEntry[];
  /**
   * The rest of the day in one sequence, without the focus: the order of
   * the day with the appointments anchored in it (`day-order.ts`), and the
   * calendar's events by clock among the appointments.
   */
  list: DayEntry[];
  /**
   * Every open item of today in the order of the day, the focus included:
   * what a new order is written from, so appointments keep their place.
   */
  sequence: DayPlannerItem[];
  /** The first of `appointments` that has not begun yet. */
  nextAppointment: AppointmentEntry | null;
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
 * Once the day has a stored order (an open item carries a dayPosition), it
 * is the first open item in that order, an appointment too, even one that
 * has not started yet. Without a stored order an appointment is up from its
 * start until its end (start plus its planned duration, or
 * DEFAULT_APPOINTMENT_MINUTES); when several are, the one that began last.
 * Otherwise it is the first untimed item of the order (`queue`), or nothing
 * when only appointments are left and none is running.
 */
export function currentItem(
  pending: readonly DayPlannerItem[],
  queue: readonly DayPlannerItem[],
  now: number,
): DayPlannerItem | null {
  if (pending.some((item) => item.dayPosition != null)) return pending[0] ?? null;
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
 * The next minute at which `currentItem` or the list of appointments can
 * change: an appointment starts (and the next one is another) or ends (and
 * is over). With `leadMinutes`, also that long before an appointment
 * starts, for a view that names it ahead (`soonAppointment`).
 * Null when nothing changes any more today. A timer waits for exactly this
 * instead of polling the clock.
 */
export function nextChangeAt(
  planner: DayPlannerResponse,
  now: number,
  leadMinutes = 0,
): number | null {
  const moments: number[] = [];
  const ahead = (start: number) => (leadMinutes ? [start - leadMinutes] : []);
  for (const item of planner.items) {
    if (item.status !== "pending" || item.isOverdue) continue;
    const window = appointmentWindow(item);
    if (window)
      moments.push(
        ...ahead(window.start),
        window.start,
        window.start + 1,
        window.end,
      );
  }
  for (const event of planner.externalEvents) {
    const { minutes } = clockOf(event.start);
    moments.push(...ahead(minutes), minutes + 1, eventEnd(event));
  }
  const later = moments.filter((moment) => moment > now && moment < 1440);
  return later.length ? Math.min(...later) : null;
}

/** Where an event ends today; one running past midnight ends at 1440. */
function eventEnd(event: ExternalEvent): number {
  const start = clockOf(event.start).minutes;
  const end = clockOf(event.end).minutes;
  const length = Date.parse(event.end) - Date.parse(event.start);
  return end < start || length >= 86_400_000 ? 1440 : end;
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

  const events: AppointmentEntry[] = planner.externalEvents.map((event) => ({
    kind: "event",
    ...clockOf(event.start),
    past: eventEnd(event) <= now,
    event,
  }));
  const items: AppointmentEntry[] = timed
    .filter(({ item }) => item !== focus)
    .map(({ item, clock }) => ({
      kind: "item",
      ...clock,
      past: appointmentWindow(item)!.end <= now,
      item,
    }));
  const appointments = [...items, ...events].sort(
    (first, second) => first.minutes - second.minutes,
  );

  // The server sends the day in its order: appointments already anchored.
  const list: DayEntry[] = pending
    .filter((item) => item !== focus)
    .map(
      (item) =>
        items.find((entry) => entry.kind === "item" && entry.item === item) ?? {
          kind: "row",
          item,
        },
    );
  for (const event of [...events].sort((a, b) => a.minutes - b.minutes)) {
    const timed = list.flatMap((entry, index) =>
      entry.kind === "row" ? [] : [{ entry, index }],
    );
    const later = timed.find(({ entry }) => entry.minutes > event.minutes);
    const at = later
      ? later.index
      : timed.length
        ? timed[timed.length - 1]!.index + 1
        : 0;
    list.splice(at, 0, event);
  }

  return {
    focus,
    focusWindow: focus ? appointmentWindow(focus) : null,
    carriedOver,
    appointments,
    list,
    sequence: pending,
    nextAppointment:
      appointments.find((entry) => entry.minutes >= now) ?? null,
    queue,
    resolved,
    tally: tallyOfPlanner(planner.items),
  };
}

/** How long before its start the Fokus-Modus names an appointment. */
export const APPOINTMENT_LEAD_MINUTES = 15;

/**
 * The next appointment when it starts within `leadMinutes`; null while it
 * is further away, so the time before it stays free of it.
 */
export function soonAppointment(
  agenda: TodayAgenda,
  now: number,
  leadMinutes = APPOINTMENT_LEAD_MINUTES,
): AppointmentEntry | null {
  const entry = agenda.nextAppointment;
  return entry && entry.minutes - now <= leadMinutes ? entry : null;
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
 * The planner with today's open items in the order `sequence` gives,
 * appointments kept on the clock. Everything else keeps its place, so the
 * result reads like the server's answer.
 */
export function withDayOrder(
  planner: DayPlannerResponse,
  sequence: readonly DayPlannerItem[],
): DayPlannerResponse {
  return withQueueOrder(planner, anchoredOrder(sequence).map((item, dayPosition) => ({ ...item, dayPosition })));
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
