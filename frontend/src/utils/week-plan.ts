import { anchoredOrder, type OrderRef } from "./day-order";
import type { TodoResponse } from "../types/todo";
import type {
  WeekPlanDay,
  WeekPlanEntry,
  WeekPlanEventEntry,
  WeekPlanHabitEntry,
  WeekPlanResponse,
  WeekPlanTodoEntry,
} from "../types/week-plan";
import { addDays, isValidIsoDate, weekStart } from "./date";
import { formatDuration } from "./today-agenda";

export type { OrderRef };

/** What the Questlog column shows of a quest. */
export type QuestlogQuest = Pick<
  TodoResponse,
  "id" | "title" | "plannedDurationMinutes" | "campaign" | "timerEligible"
>;

/**
 * The first day the board shows, from `?ab=` in the address: a valid day
 * after today, otherwise today. The board never starts in the past.
 */
export function firstDayFromQuery(value: unknown, today: string): string {
  return typeof value === "string" && isValidIsoDate(value) && value > today
    ? value
    : today;
}

/** The address of a first day: today has the plain `#/plan`. */
export function planQuery(first: string, today: string): { ab?: string } {
  return first === today ? {} : { ab: first };
}

/**
 * Where an old link with a week (`?woche=<Monday>`) goes now: to the first
 * day of that week still ahead, so the current week opens on today, and a
 * past or unusable one too.
 */
export function planQueryFromWeek(
  week: unknown,
  today: string,
): { ab?: string } {
  if (typeof week !== "string" || !isValidIsoDate(week)) return {};
  const monday = weekStart(week);
  return planQuery(monday > today ? monday : today, today);
}

/**
 * The first day after a step of the arrows: as many days as are shown,
 * back or ahead, but never before today.
 */
export function shiftedStart(
  first: string,
  count: number,
  direction: -1 | 1,
  today: string,
): string {
  const next = addDays(first, direction * count);
  return next < today ? today : next;
}

/** What drags: open quests, open stored runs and Google events. */
export const DRAGGABLE =
  "[data-todo-id], [data-run-id], [data-event-id], [data-forecast-id]";

/** A key unique on the board; quests keep the key Heute uses. */
export function entryKey(entry: WeekPlanEntry, date: string): string {
  if (entry.type === "todo") return `todo-${entry.todoId}`;
  if (entry.type === "event") return `event-${entry.eventId}-${date}`;
  return entry.occurrenceId === null
    ? `forecast-${entry.habitId}-${date}`
    : `habit-${entry.occurrenceId}`;
}

/** An open quest: it drags, moves and sorts. */
export function isMovable(entry: WeekPlanEntry): entry is WeekPlanTodoEntry {
  return entry.type === "todo" && entry.status === "pending";
}

/** A daily's run that is stored and open, so it is sorted and moved like Heute's. */
export type OpenRun = WeekPlanHabitEntry & { occurrenceId: number };

/**
 * An open stored run: it drags within its day, onto another day of its
 * window and takes the arrow keys. A run the schedule only forecasts has
 * nothing stored to sort or move yet.
 */
export function isMovableRun(entry: WeekPlanEntry): entry is OpenRun {
  return (
    entry.type === "habit" &&
    entry.status === "pending" &&
    entry.occurrenceId !== null
  );
}

/**
 * A run the schedule only forecasts on a later day: nothing is stored yet,
 * so it neither ticks, sorts nor moves; it shows as planned, not there.
 */
export function isForecast(entry: WeekPlanEntry): boolean {
  return (
    entry.type === "habit" &&
    entry.status === "pending" &&
    entry.occurrenceId === null
  );
}

/** Whether a run may lie on `date`: from today to the end of its window. */
export function runMayMoveTo(
  entry: OpenRun,
  date: string,
  today: string,
): boolean {
  return date >= today && entry.moveUntil !== null && date <= entry.moveUntil;
}

/** A Google event: it sorts among the cards of its day, its time stays. */
export function isEvent(entry: WeekPlanEntry): entry is WeekPlanEventEntry {
  return entry.type === "event";
}

export function openEntries(day: WeekPlanDay): WeekPlanEntry[] {
  return day.entries.filter((entry) => entry.status === "pending");
}

/** What is done or skipped, a Google event ticked off among them. */
export function doneEntries(day: WeekPlanDay): WeekPlanEntry[] {
  return day.entries.filter((entry) => entry.status !== "pending");
}

/**
 * The plan with the Google event `eventId` ticked off or open again on
 * every day it stands, shown before the server answers.
 */
export function withEventDone(
  plan: WeekPlanResponse,
  eventId: number,
  done: boolean,
): WeekPlanResponse {
  const status = done ? "completed" : "pending";
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      entries: day.entries.map((entry) =>
        entry.type === "event" && entry.eventId === eventId
          ? { ...entry, status }
          : entry,
      ),
    })),
  };
}

/**
 * Whether an entry takes part in the day's stored order: open and stored on
 * the server. Appointments take part as anchors, held on the clock.
 */
export function isSequenced(entry: WeekPlanEntry): boolean {
  // A forecast run takes part too: its place waits for its day.
  return entry.status === "pending";
}

/** The order of the day `date` as the server stores it. */
export function dayOrder(
  open: readonly WeekPlanEntry[],
  date: string,
): OrderRef[] {
  return open.filter(isSequenced).map((entry): OrderRef => {
    if (entry.type === "todo") return { type: "todo", id: entry.todoId };
    if (entry.type === "event") return { type: "event", id: entry.eventId };
    return entry.occurrenceId === null
      ? { type: "forecast", id: entry.habitId, date }
      : { type: "habit", id: entry.occurrenceId };
  });
}

/**
 * The open rows of a day the way the server sorts them (day-order.ts), with
 * the sequenced ones in the order given and the appointments among them
 * held on the clock. An untimed forecast follows the stored entries.
 */
export function arrangeOpen(open: readonly WeekPlanEntry[]): WeekPlanEntry[] {
  return anchoredOrder(open, isSequenced);
}

/**
 * A quest of the Questlog as a row of the board, so the column shows it like
 * the days do and a drop can place it before the server answers.
 */
export function questlogEntry(
  todo: QuestlogQuest,
  date: string,
): WeekPlanTodoEntry {
  return {
    type: "todo",
    todoId: todo.id,
    status: "pending",
    scheduledDate: date,
    title: todo.title,
    timeOfDay: null,
    plannedDurationMinutes: todo.plannedDurationMinutes,
    campaign: todo.campaign,
    isOverdue: false,
  };
}

/** "3 offen · 1 Std. 30 Min.": what is still open on a day; empty when nothing is. */
export function openSummary(day: WeekPlanDay): string {
  // Google events are not the person's to do: they do not count.
  const open = openEntries(day).filter((entry) => !isEvent(entry));
  if (!open.length) return "";
  const minutes = open.reduce(
    (sum, entry) => sum + (entry.plannedDurationMinutes ?? 0),
    0,
  );
  return minutes
    ? `${open.length} offen · ${formatDuration(minutes)}`
    : `${open.length} offen`;
}

/** What `localStorage` keeps under `plan:questlog`: an explicit choice. */
export type QuestlogChoice = "open" | "closed";

/**
 * Whether the Questlog column starts open. A choice made on this device
 * wins; without one it opens when the board fits the Questlog and one day,
 * so a smaller one gives its room to the days first.
 */
export function questlogStartsOpen(
  stored: string | null,
  roomy: boolean,
): boolean {
  if (stored === "open") return true;
  if (stored === "closed") return false;
  return roomy;
}

/**
 * The board's measures in rem. A day column is never narrower than readable
 * titles need; the Questlog column is open or a rail as wide as its toggle.
 */
export const BOARD = {
  column: 14,
  gap: 0.5,
  questlogOpen: 12,
  questlogRail: 2.75,
} as const;

/** The most days one read of the board answers (as the server allows). */
export const MAX_PLAN_DAYS = 31;

/** The Questlog column's width in rem. */
export function questlogWidth(open: boolean): number {
  return open ? BOARD.questlogOpen : BOARD.questlogRail;
}

/**
 * How many days fit beside the Questlog column (and the column of what was
 * left behind, when there is one) in `width` rem, but at least `least`:
 * today always shows, and with too little room the board scrolls instead.
 */
export function fittingDays(
  width: number,
  board: { questlogOpen: boolean; overdue: boolean; overdueOpen?: boolean; least: number },
): number {
  let room = width - questlogWidth(board.questlogOpen);
  if (board.overdue) room -= BOARD.gap + (board.overdueOpen === false ? BOARD.questlogRail : BOARD.column);
  const fit = Math.floor((room + 0.001) / (BOARD.gap + BOARD.column));
  return Math.max(board.least, fit);
}

/** The board's grid columns: Questlog, what was left behind, the days. */
export function boardColumns(board: {
  questlogOpen: boolean;
  overdue: boolean;
  overdueOpen?: boolean;
  days: number;
}): string {
  const day = `minmax(${BOARD.column}rem, 1fr)`;
  return [
    `${questlogWidth(board.questlogOpen)}rem`,
    ...(board.overdue ? [board.overdueOpen === false ? `${BOARD.questlogRail}rem` : day] : []),
    `repeat(${board.days}, ${day})`,
  ].join(" ");
}

/** A column's horizontal extent inside the board, in pixels. */
export type ColumnSpan = { start: number; end: number };

/**
 * Where the board opens when its columns do not all fit: at the start while
 * today is fully visible from there, otherwise just far enough that today
 * stands right beside the Questlog column, which stays in place (`sticky`
 * is its width with the gap). With `lead` (the Kalender week) today always
 * comes first beside the sticky column, even when it would fit further on.
 */
export function todayScroll(
  today: ColumnSpan,
  view: { width: number; sticky: number; lead?: boolean },
): number {
  if (!view.lead && today.end <= view.width) return 0;
  return Math.max(0, today.start - view.sticky);
}

/**
 * The minute of the day the Kalender week opens on: an hour and a half
 * before now in the current week, else half an hour before the first entry,
 * else 8:00. Always a full hour, so the first hour's label stands whole
 * under the sticky heads instead of half cut off by them.
 */
export function weekOpenMinute(
  now: number | null,
  firstEntry: number | null,
): number {
  const target = now !== null ? now - 90 : firstEntry !== null ? firstEntry - 30 : 8 * 60;
  return Math.max(0, Math.floor(target / 60) * 60);
}

/*
 * On a phone (below 40rem) every column of the board is as wide as the
 * screen and snaps into place; a strip of chips above names the columns
 * and jumps to them. A week of days to swipe through, after the Questlog
 * and what was left behind.
 */
export const PHONE_PLAN_DAYS = 7;

/** A chip of the phone's strip: one per column, in the board's order. */
export type PlanChip = {
  /** "questlog", "overdue" or the day's date. */
  key: string;
  /** What the chip says: "Questlog", "Liegen geblieben", "Heute", "Mi". */
  label: string;
  /** Its spoken name, a day with its date: "Mittwoch, 26. Nov.". */
  name: string;
};

const SHORT_WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
const LONG_WEEKDAYS = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
] as const;
const MONTHS = [
  "Jan.",
  "Feb.",
  "März",
  "Apr.",
  "Mai",
  "Juni",
  "Juli",
  "Aug.",
  "Sept.",
  "Okt.",
  "Nov.",
  "Dez.",
] as const;

/** The columns of the board as chips: Questlog · Liegen geblieben · Heute · Mi … */
export function planChips(board: {
  overdue: boolean;
  days: readonly string[];
  today: string;
}): PlanChip[] {
  const days = board.days.map((date): PlanChip => {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const spoken = `${LONG_WEEKDAYS[weekday]}, ${Number(date.slice(8, 10))}. ${
      MONTHS[Number(date.slice(5, 7)) - 1]
    }`;
    return date === board.today
      ? { key: date, label: "Heute", name: `Heute, ${spoken}` }
      : { key: date, label: SHORT_WEEKDAYS[weekday]!, name: spoken };
  });
  return [
    { key: "questlog", label: "Questlog", name: "Questlog" },
    ...(board.overdue
      ? [{ key: "overdue", label: "Liegen geblieben", name: "Liegen geblieben" }]
      : []),
    ...days,
  ];
}

/** Where the phone's board opens: on today, else on its first day. */
export function startColumn(chips: readonly PlanChip[], today: string): number {
  const todayIndex = chips.findIndex((chip) => chip.key === today);
  if (todayIndex >= 0) return todayIndex;
  const firstDay = chips.findIndex(
    (chip) => chip.key !== "questlog" && chip.key !== "overdue",
  );
  return Math.max(0, firstDay);
}

/**
 * The column in view on the phone's board: each column is one `step` wide
 * (the board's width plus the gap), the nearest one counts.
 */
export function columnAt(scrollLeft: number, step: number, count: number): number {
  if (step <= 0 || count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(scrollLeft / step)));
}
