import type {
  HistoryDayWork,
  HistoryItem,
  HistoryPlannedItem,
  HistoryWorkLog,
} from "../types/history";
import {
  APP_TIME_ZONE,
  formatTimeForGermanDisplay,
  getCurrentDateInTimeZone,
} from "./date";
import { formatDuration } from "./today-agenda";

export { formatDuration };

/**
 * The day's time axis in the calendar: what was planned beside what was
 * measured (the Logbuch). Positions are minutes after midnight on the Berlin
 * wall clock, which is what the hour lines are labelled with.
 */
const DAY_MINUTES = 24 * 60;
/** How long an appointment without a duration takes on the axis. */
const DEFAULT_APPOINTMENT_MINUTES = 30;
/** One hour of the axis, in rem. */
export const HOUR_REM = 4;
/** No block is drawn smaller than a tap target (2.75rem) and its 1px margins. */
export const MIN_BLOCK_MINUTES = ((2.75 + 0.125) / HOUR_REM) * 60;
/** A completion is a moment, not a stretch: a mark of 1.5rem and its margins. */
export const DONE_MARK_MINUTES = ((1.5 + 0.125) / HOUR_REM) * 60;
/** The axis of an empty day; a fuller one never starts later or ends earlier. */
export const DEFAULT_HOURS = { from: 8, to: 18 } as const;

export type AxisBlock = {
  key: string;
  start: number;
  end: number;
  /** Minutes the block takes on the axis at least; the lane's own by default. */
  minLength?: number;
};
export type Placed<T> = T & { column: number; columns: number };

export type PlanBlock = AxisBlock & {
  title: string;
  /** "09:30" or "09:30–10:15"; for a completion the time it was ticked off. */
  time: string;
  /** "done" marks the moment something without a planned time was ticked off. */
  source: "appointment" | "event" | "done";
};

/** Where a block ends as drawn: a short one still takes its least room. */
export function drawnEnd(
  block: AxisBlock,
  minLength = MIN_BLOCK_MINUTES,
): number {
  return Math.max(block.end, block.start + (block.minLength ?? minLength));
}
export type LogBlock = AxisBlock & { log: HistoryWorkLog };

type PlannedDay = {
  date: string;
  items: HistoryItem[];
  planned?: HistoryPlannedItem[];
  external?: { id: number; title: string; start: string; end: string }[];
};

const clockMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours! * 60 + minutes!;
};

/** Where an instant lies on the axis of `date`: 0 before it, 1440 after it. */
export function minuteOfDay(instant: string, date: string): number {
  const day = getCurrentDateInTimeZone(APP_TIME_ZONE, new Date(instant));
  if (day < date) return 0;
  if (day > date) return DAY_MINUTES;
  return clockMinutes(formatTimeForGermanDisplay(instant));
}

/** "2 Std. 15 Min." in a narrow space: "2:15 h". */
export function compactDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")} h`;
}

/** "09:10–09:35" of a stretch, with its real times even across midnight. */
export function logTimes(log: HistoryWorkLog): string {
  return `${formatTimeForGermanDisplay(log.startedAt)}–${formatTimeForGermanDisplay(log.endedAt)}`;
}

/** The whole stretch in words, for screen readers. */
export function logLabel(log: HistoryWorkLog): string {
  const parts = [
    log.title,
    `${formatTimeForGermanDisplay(log.startedAt)} bis ${formatTimeForGermanDisplay(log.endedAt)}`,
    formatDuration(log.minutes),
    log.campaign ? `Kampagne ${log.campaign.title}` : "ohne Kampagne",
  ];
  return parts.join(", ");
}

/**
 * The day's appointments, timed dailies and calendar events, and the moments
 * the rest was ticked off. Skipped runs did not happen. A completion with a
 * planned time stands as its appointment; one without stands as a small mark
 * at the time it was done, so a quest ticked off at 05:37 is on the axis.
 */
export function planBlocks(day: PlannedDay): PlanBlock[] {
  const timed = (
    key: string,
    title: string,
    timeOfDay: string,
    minutes: number | null,
  ): PlanBlock => {
    const start = clockMinutes(timeOfDay);
    return {
      key,
      title,
      time: timeOfDay.slice(0, 5),
      source: "appointment",
      start,
      end: Math.min(DAY_MINUTES, start + (minutes ?? DEFAULT_APPOINTMENT_MINUTES)),
    };
  };
  return [
    ...day.items.flatMap((item) =>
      item.timeOfDay && item.status === "completed"
        ? [
            timed(
              `item:${item.type}-${item.id}`,
              item.title,
              item.timeOfDay,
              item.plannedDurationMinutes,
            ),
          ]
        : [],
    ),
    ...(day.planned ?? []).flatMap((item) =>
      item.timeOfDay
        ? [
            timed(
              `planned:${item.key}`,
              item.title,
              item.timeOfDay,
              item.plannedDurationMinutes,
            ),
          ]
        : [],
    ),
    ...(day.external ?? []).map((event) => ({
      key: `event:${event.id}`,
      title: event.title,
      time: `${formatTimeForGermanDisplay(event.start)}–${formatTimeForGermanDisplay(event.end)}`,
      source: "event" as const,
      start: minuteOfDay(event.start, day.date),
      end: minuteOfDay(event.end, day.date),
    })),
    ...doneMarks(day),
  ];
}

/**
 * Completions without a planned time, as marks at the time they were ticked
 * off. Marks close together stack below each other instead of sharing the
 * lane's width, so each keeps a readable title; the time stays in the label.
 */
function doneMarks(day: PlannedDay): PlanBlock[] {
  const marks = day.items
    .flatMap((item) =>
      item.status === "completed" && !item.timeOfDay && item.resolvedAt
        ? [{ item, at: minuteOfDay(item.resolvedAt, day.date) }]
        : [],
    )
    .sort((a, b) => a.at - b.at);
  let free = -Infinity;
  return marks.map(({ item, at }) => {
    const start = Math.max(at, free);
    free = start + DONE_MARK_MINUTES;
    return {
      key: `done:${item.type}-${item.id}`,
      title: item.title,
      time: formatTimeForGermanDisplay(item.resolvedAt!),
      source: "done" as const,
      start,
      end: start,
      minLength: DONE_MARK_MINUTES,
    };
  });
}

/** The day's stretches, cut to the day. */
export function logBlocks(work: HistoryDayWork, date: string): LogBlock[] {
  return (work.logs ?? []).map((log) => {
    const start = minuteOfDay(log.startedAt, date);
    // The repeated hour in autumn can make the wall clock run backwards.
    const end = Math.max(start, minuteOfDay(log.endedAt, date));
    return { key: `log:${log.id}`, log, start, end };
  });
}

/**
 * Places blocks that share time side by side. Each block takes at least
 * `minLength` minutes of room, so a short one never hides under its
 * neighbour; blocks that touch through a chain share the same columns.
 */
export function layoutLane<T extends AxisBlock>(
  blocks: T[],
  minLength = MIN_BLOCK_MINUTES,
): Placed<T>[] {
  const sorted = [...blocks].sort(
    (a, b) => a.start - b.start || b.end - a.end || a.key.localeCompare(b.key),
  );
  const placed: Placed<T>[] = [];
  let group: Placed<T>[] = [];
  let columnEnds: number[] = [];
  let groupEnd = -Infinity;
  const close = () => {
    for (const block of group) block.columns = columnEnds.length;
  };
  for (const block of sorted) {
    const reach = drawnEnd(block, minLength);
    if (block.start >= groupEnd) {
      close();
      group = [];
      columnEnds = [];
    }
    let column = columnEnds.findIndex((end) => end <= block.start);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = reach;
    const item = { ...block, column, columns: 1 };
    group.push(item);
    placed.push(item);
    groupEnd = Math.max(groupEnd, reach);
  }
  close();
  return placed;
}

/**
 * The hours the axis shows: from the full hour of the earliest planned item,
 * stretch or completion to the full hour after the latest one as drawn. It
 * never starts later than 8 or ends earlier than 18, so a day with little in
 * it still reads as a day, and an empty one shows 8 to 18.
 */
export function axisHours(
  blocks: AxisBlock[],
  minLength = MIN_BLOCK_MINUTES,
): { from: number; to: number } {
  const starts = blocks.map((block) => block.start);
  const ends = blocks.map((block) => drawnEnd(block, minLength));
  return {
    from: Math.max(
      0,
      Math.min(DEFAULT_HOURS.from, Math.floor(Math.min(...starts) / 60)),
    ),
    to: Math.min(
      24,
      Math.max(DEFAULT_HOURS.to, Math.ceil(Math.max(...ends) / 60)),
    ),
  };
}
