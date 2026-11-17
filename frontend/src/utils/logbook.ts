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

export type AxisBlock = { key: string; start: number; end: number };
export type Placed<T> = T & { column: number; columns: number };

export type PlanBlock = AxisBlock & {
  title: string;
  /** "09:30" or "09:30–10:15". */
  time: string;
  source: "appointment" | "event";
};
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

/** The day's appointments, timed dailies and calendar events. Skipped runs did not happen. */
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
  ];
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
    const drawnEnd = Math.max(block.end, block.start + minLength);
    if (block.start >= groupEnd) {
      close();
      group = [];
      columnEnds = [];
    }
    let column = columnEnds.findIndex((end) => end <= block.start);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = drawnEnd;
    const item = { ...block, column, columns: 1 };
    group.push(item);
    placed.push(item);
    groupEnd = Math.max(groupEnd, drawnEnd);
  }
  close();
  return placed;
}

/** The hours the axis shows: at least 8 to 18, widened to every block. */
export function axisHours(
  blocks: AxisBlock[],
  minLength = MIN_BLOCK_MINUTES,
): { from: number; to: number } {
  const starts = blocks.map((block) => block.start);
  const ends = blocks.map((block) =>
    Math.max(block.end, block.start + minLength),
  );
  return {
    from: Math.max(0, Math.min(8, Math.floor(Math.min(...starts) / 60))),
    to: Math.min(24, Math.max(18, Math.ceil(Math.max(...ends) / 60))),
  };
}
