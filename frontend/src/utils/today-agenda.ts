import type { DayPlannerItem, DayPlannerResponse } from "../types/day-planner";

export type ExternalEvent = DayPlannerResponse["externalEvents"][number];

/** One row of the day's time axis: a planned item or a calendar event. */
export type TimelineEntry =
  | { kind: "item"; minutes: number; time: string; item: DayPlannerItem }
  | { kind: "event"; minutes: number; time: string; event: ExternalEvent };

export type TodayAgenda = {
  /** The one thing that is up now, shown large with its why. */
  focus: DayPlannerItem | null;
  /** The next entry on the axis, so the following step is already in sight. */
  next: TimelineEntry | null;
  /** Open items from earlier days, offered for catching up. */
  carriedOver: DayPlannerItem[];
  /** Today's timed items and events in clock order, without the focus. */
  timeline: TimelineEntry[];
  /** Index in `timeline` where "now" falls. */
  nowIndex: number;
  /** Open items without a time, without the focus. */
  anytime: DayPlannerItem[];
  resolved: DayPlannerItem[];
  done: number;
  total: number;
};

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

/** The clock time an item is planned for today, if it has one. */
export function plannedClock(
  item: DayPlannerItem,
): { minutes: number; time: string } | null {
  if (item.type === "todo") {
    const instant = item.scheduledAt ?? item.completedAt;
    return instant ? clockOf(instant) : null;
  }
  if (!item.timeOfDay) return null;
  const [hours, minutes] = item.timeOfDay.split(":").map(Number);
  return {
    minutes: hours! * 60 + minutes!,
    time: item.timeOfDay.slice(0, 5),
  };
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

  const timedPending = pending
    .map((item) => ({ item, clock: plannedClock(item) }))
    .filter(
      (
        entry,
      ): entry is {
        item: DayPlannerItem;
        clock: { minutes: number; time: string };
      } => entry.clock !== null,
    )
    .sort((first, second) => first.clock.minutes - second.clock.minutes);
  const untimed = pending.filter((item) => plannedClock(item) === null);

  // Up now: the first timed item not yet over, else anything still open.
  const current = timedPending.find(
    ({ item, clock }) =>
      clock.minutes + (item.plannedDurationMinutes ?? 0) >= now,
  );
  const focus =
    current?.item ?? untimed[0] ?? timedPending.at(-1)?.item ?? null;

  const events: TimelineEntry[] = planner.externalEvents.map((event) => ({
    kind: "event",
    ...clockOf(event.start),
    event,
  }));
  const items: TimelineEntry[] = timedPending
    .filter(({ item }) => item !== focus)
    .map(({ item, clock }) => ({ kind: "item", ...clock, item }));
  const timeline = [...items, ...events].sort(
    (first, second) => first.minutes - second.minutes,
  );
  const nowIndex = timeline.findIndex((entry) => entry.minutes >= now);

  // The focus is not on the axis, so the first entry from now on comes next.
  const next = nowIndex === -1 ? null : timeline[nowIndex]!;

  return {
    focus,
    next,
    carriedOver,
    timeline,
    nowIndex: nowIndex === -1 ? timeline.length : nowIndex,
    anytime: untimed.filter((item) => item !== focus),
    resolved,
    done: resolved.length,
    total: today.length,
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
