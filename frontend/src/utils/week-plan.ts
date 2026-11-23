import { anchoredOrder, clockBoundIndex } from "./day-order";
import type { TodoResponse } from "../types/todo";
import type {
  WeekPlanDay,
  WeekPlanEntry,
  WeekPlanHabitEntry,
  WeekPlanResponse,
  WeekPlanTodoEntry,
} from "../types/week-plan";
import { addDays, isValidIsoDate, weekStart } from "./date";
import { formatDuration } from "./today-agenda";

/** How the server names an item of a day's order (PUT /day-planner/order). */
export type OrderRef = { type: "todo" | "habit"; id: number };

/** A quest dropped on a day: `index` is its place among the day's open rows. */
export type Drop = { todoId: number; toDate: string; index: number };

/** A daily's stored run dropped on a day, at `index` among its open rows. */
export type RunDrop = { occurrenceId: number; toDate: string; index: number };

/** A quest dropped into the Questlog column, at `index` of its list. */
export type ShelfDrop = { todoId: number; index: number };

/** Where a drag on the board ended: on a day or in the Questlog column. */
export type BoardDrop =
  | { kind: "day"; drop: Drop }
  | { kind: "run"; drop: RunDrop }
  | { kind: "questlog"; drop: ShelfDrop };

/** What a drop asks of the server: move the quest, then sort its day. */
export type DropWrite = {
  todoId: number;
  /** The day to reschedule to; null when the quest stays on its day. */
  moveTo: string | null;
  /** An appointment keeps its time; moving it needs the confirmation. */
  confirmFixed: boolean;
  /** The new order of the target day; null when nothing to sort changed. */
  order: OrderRef[] | null;
};

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

/** What drags on the board: open quests and open stored runs. */
export const DRAGGABLE = "[data-todo-id], [data-run-id]";

/** A key unique on the board; quests keep the key Heute uses. */
export function entryKey(entry: WeekPlanEntry, date: string): string {
  if (entry.type === "todo") return `todo-${entry.todoId}`;
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

/** Whether a run may lie on `date`: from today to the end of its window. */
export function runMayMoveTo(
  entry: OpenRun,
  date: string,
  today: string,
): boolean {
  return date >= today && entry.moveUntil !== null && date <= entry.moveUntil;
}

export function openEntries(day: WeekPlanDay): WeekPlanEntry[] {
  return day.entries.filter((entry) => entry.status === "pending");
}

export function doneEntries(day: WeekPlanDay): WeekPlanEntry[] {
  return day.entries.filter((entry) => entry.status !== "pending");
}

/**
 * Whether an entry takes part in the day's stored order: open and stored on
 * the server. Appointments take part as anchors, held on the clock.
 */
function isSequenced(entry: WeekPlanEntry): boolean {
  if (entry.status !== "pending") return false;
  return entry.type === "todo" || entry.occurrenceId !== null;
}

/** The order of a day as the server stores it. */
export function dayOrder(open: readonly WeekPlanEntry[]): OrderRef[] {
  return open.filter(isSequenced).map((entry) =>
    entry.type === "todo"
      ? { type: "todo", id: entry.todoId }
      : { type: "habit", id: entry.occurrenceId! },
  );
}

/**
 * The open rows of a day the way the server sorts them (day-order.ts), with
 * the sequenced ones in the order given and the appointments among them
 * held on the clock. An untimed forecast follows the stored entries.
 */
export function arrangeOpen(open: readonly WeekPlanEntry[]): WeekPlanEntry[] {
  return anchoredOrder(open, isSequenced);
}

const withOpen = (day: WeekPlanDay, open: WeekPlanEntry[]): WeekPlanDay => ({
  ...day,
  entries: [...open, ...doneEntries(day)],
});

/** The open quest `todoId` among `entries`, if it is there. */
function questIn(
  entries: readonly WeekPlanEntry[],
  todoId: number,
): WeekPlanTodoEntry | undefined {
  return entries.find(
    (item): item is WeekPlanTodoEntry =>
      isMovable(item) && item.todoId === todoId,
  );
}

/** The open stored run `occurrenceId` among `entries`, if it is there. */
function runIn(
  entries: readonly WeekPlanEntry[],
  occurrenceId: number,
): OpenRun | undefined {
  return entries.find(
    (item): item is OpenRun =>
      isMovableRun(item) && item.occurrenceId === occurrenceId,
  );
}

/** An open entry put on a day: the plan as shown, and the day's new order. */
type Placed = { plan: WeekPlanResponse; order: OrderRef[] | null };

/**
 * Puts the open `entry` at `index` of the day `toDate`, as `placed` (the
 * entry as it will stand there). It comes from the day `from.source`, from
 * what was left behind (`from.overdue`), or from nowhere (a quest of the
 * Questlog). Returns null when nothing changes.
 */
function place(
  plan: WeekPlanResponse,
  entry: WeekPlanEntry,
  placed: WeekPlanEntry,
  from: { source?: WeekPlanDay; overdue: boolean; moves: boolean },
  toDate: string,
  index: number,
): Placed | null {
  const target = plan.days.find((day) => day.date === toDate);
  if (!target || toDate < plan.today) return null;
  const rows = openEntries(target).filter((item) => item !== entry);
  rows.splice(clockBoundIndex(rows, placed, Math.max(0, Math.min(index, rows.length))), 0, placed);
  const arranged = arrangeOpen(rows);

  const before = dayOrder(openEntries(target));
  const after = dayOrder(arranged);
  const sorted =
    from.moves || JSON.stringify(before) !== JSON.stringify(after);
  if (!from.moves && !sorted) return null;

  return {
    plan: {
      ...plan,
      overdue: from.overdue
        ? plan.overdue.filter((item) => item !== entry)
        : plan.overdue,
      days: plan.days.map((day) => {
        if (day === target) return withOpen(day, arranged);
        if (day === from.source)
          return withOpen(
            day,
            openEntries(day).filter((item) => item !== entry),
          );
        return day;
      }),
    },
    order: sorted ? after : null,
  };
}

/**
 * Applies a drop to the plan at once and says what to write. Dropped on a
 * day it is not planned for (another day, or any day for a quest left
 * behind), the quest moves there and takes its place in that day's order;
 * an appointment's place is bounded by the clock, after the appointments
 * earlier and before those later than it (`clockBoundIndex`). Returns null
 * when the drop changes nothing.
 *
 * `incoming` is a quest from the Questlog column: it has no day yet, so it
 * comes from no column of the board and always moves.
 */
export function dropOnDay(
  plan: WeekPlanResponse,
  drop: Drop,
  incoming?: WeekPlanTodoEntry,
): { plan: WeekPlanResponse; write: DropWrite } | null {
  const overdue = incoming ? undefined : questIn(plan.overdue, drop.todoId);
  const source =
    incoming || overdue
      ? undefined
      : plan.days.find((day) => questIn(day.entries, drop.todoId));
  const entry =
    incoming ?? overdue ?? (source && questIn(source.entries, drop.todoId));
  if (!entry) return null;
  const moves = !!incoming || entry.scheduledDate !== drop.toDate;
  const placed: WeekPlanTodoEntry = moves
    ? { ...entry, scheduledDate: drop.toDate, isOverdue: false }
    : entry;
  const result = place(
    plan,
    entry,
    placed,
    { source, overdue: !!overdue, moves },
    drop.toDate,
    drop.index,
  );
  if (!result) return null;
  return {
    plan: result.plan,
    write: {
      todoId: entry.todoId,
      moveTo: moves ? drop.toDate : null,
      confirmFixed: entry.timeOfDay !== null,
      order: result.order,
    },
  };
}

/** What a run's drop asks of the server: move it in its window, then sort its day. */
export type RunDropWrite = {
  occurrenceId: number;
  /** The day to move the run to; null when it stays on its day. */
  moveTo: string | null;
  /** The new order of the target day; null when nothing to sort changed. */
  order: OrderRef[] | null;
};

/**
 * A daily's stored run dropped on a day, applied at once like a quest's
 * drop: on its own day it takes its place in the order; on another day it
 * moves there, but only within its window (from today to `moveUntil`, the
 * rule of Heute's "Morgen" and "Anderer Tag …"). Returns null when the drop
 * changes nothing or leaves the window.
 */
export function dropRunOnDay(
  plan: WeekPlanResponse,
  drop: RunDrop,
): { plan: WeekPlanResponse; write: RunDropWrite } | null {
  const overdue = runIn(plan.overdue, drop.occurrenceId);
  const source = overdue
    ? undefined
    : plan.days.find((day) => runIn(day.entries, drop.occurrenceId));
  const entry = overdue ?? (source && runIn(source.entries, drop.occurrenceId));
  if (!entry) return null;
  const moves = !source || source.date !== drop.toDate;
  if (moves && !runMayMoveTo(entry, drop.toDate, plan.today)) return null;
  const placed: OpenRun = moves ? { ...entry, isOverdue: false } : entry;
  const result = place(
    plan,
    entry,
    placed,
    { source, overdue: !!overdue, moves },
    drop.toDate,
    drop.index,
  );
  if (!result) return null;
  return {
    plan: result.plan,
    write: {
      occurrenceId: entry.occurrenceId,
      moveTo: moves ? drop.toDate : null,
      order: result.order,
    },
  };
}

/**
 * Where a step takes the open entry that `matches`: up and down to the next
 * place in its day's order, left and right to the end of the shown day
 * before or after (never into the past). Null where there is no such place.
 */
function stepPlace(
  plan: WeekPlanResponse,
  matches: (entry: WeekPlanEntry) => boolean,
  direction: "up" | "down" | "left" | "right",
): { toDate: string; index: number } | null {
  const dayIndex = plan.days.findIndex((day) =>
    openEntries(day).some(matches),
  );
  const day = plan.days[dayIndex];
  if (!day) return null;
  const open = openEntries(day);
  const entry = open.find(matches)!;
  if (direction === "left" || direction === "right") {
    const next = plan.days[dayIndex + (direction === "left" ? -1 : 1)];
    if (!next || next.date < plan.today) return null;
    return { toDate: next.date, index: openEntries(next).length };
  }
  // An appointment holds its place by the clock; others step past it.
  if (!isSequenced(entry)) return null;
  const sequence = open.filter(isSequenced);
  const neighbour =
    sequence[sequence.indexOf(entry) + (direction === "up" ? -1 : 1)];
  if (!neighbour) return null;
  if (entry.timeOfDay && neighbour.timeOfDay && entry.timeOfDay !== neighbour.timeOfDay) return null;
  return { toDate: day.date, index: open.indexOf(neighbour) };
}

/**
 * Where a step takes a quest: up and down ("Nach oben", "Nach unten", the
 * arrow keys) to the next place in the day's order, left and right (the
 * arrow keys) to the end of the day before or after. Returns null where
 * there is no such place (the edge of the board, the past, a fixed time).
 */
export function stepDrop(
  plan: WeekPlanResponse,
  todoId: number,
  direction: "up" | "down" | "left" | "right",
): Drop | null {
  const step = stepPlace(
    plan,
    (entry) => isMovable(entry) && entry.todoId === todoId,
    direction,
  );
  return step && { todoId, ...step };
}

/**
 * The same steps for a daily's stored run; left and right stay within its
 * window, so a run never goes where Heute could not move it.
 */
export function stepRunDrop(
  plan: WeekPlanResponse,
  occurrenceId: number,
  direction: "up" | "down" | "left" | "right",
): RunDrop | null {
  const step = stepPlace(
    plan,
    (entry) => isMovableRun(entry) && entry.occurrenceId === occurrenceId,
    direction,
  );
  if (!step) return null;
  if (direction === "left" || direction === "right") {
    const entry = plan.days
      .map((day) => runIn(day.entries, occurrenceId))
      .find(Boolean)!;
    if (!runMayMoveTo(entry, step.toDate, plan.today)) return null;
  }
  return { occurrenceId, ...step };
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

/** The board without the open quest `todoId`. */
function withoutQuest(
  plan: WeekPlanResponse,
  todoId: number,
): WeekPlanResponse {
  const keep = (entry: WeekPlanEntry) =>
    !(isMovable(entry) && entry.todoId === todoId);
  return {
    ...plan,
    overdue: plan.overdue.filter(keep),
    days: plan.days.map((day) => ({
      ...day,
      entries: day.entries.filter(keep),
    })),
  };
}

/**
 * Applies a drop into the Questlog column at once and says what to write:
 * a quest of the column takes its new place; a quest from a day (or one
 * left behind) loses its day and lands where it was dropped. `order` is the
 * column's whole new order. Returns null when nothing changes.
 */
export function shelveQuest(
  plan: WeekPlanResponse,
  backlog: readonly QuestlogQuest[],
  drop: ShelfDrop,
): {
  plan: WeekPlanResponse;
  backlog: QuestlogQuest[];
  write: { todoId: number; unplan: boolean; order: number[] };
} | null {
  const queued = backlog.find((quest) => quest.id === drop.todoId);
  const entry = queued
    ? undefined
    : questIn(
        [...plan.overdue, ...plan.days.flatMap((day) => day.entries)],
        drop.todoId,
      );
  const quest: QuestlogQuest | undefined =
    queued ??
    (entry && {
      id: entry.todoId,
      title: entry.title,
      plannedDurationMinutes: entry.plannedDurationMinutes,
      campaign: entry.campaign,
      timerEligible: true,
    });
  if (!quest) return null;
  const rows = backlog.filter((item) => item !== quest);
  rows.splice(Math.max(0, Math.min(drop.index, rows.length)), 0, quest);
  const order = rows.map(({ id }) => id);
  if (queued && order.every((id, index) => backlog[index]?.id === id))
    return null;
  return {
    plan: queued ? plan : withoutQuest(plan, quest.id),
    backlog: rows,
    write: { todoId: quest.id, unplan: !queued, order },
  };
}

/**
 * What a drag means, read from the card (a quest names `data-todo-id`, a
 * daily's stored run `data-run-id`) and the list it landed in: a day's list
 * names its date (`data-date`), the Questlog column's list says so
 * (`data-questlog`). The column of what was left behind takes no drops, and
 * a run never goes into the Questlog.
 */
export function boardDrop(
  item: HTMLElement,
  list: HTMLElement,
  index: number,
): BoardDrop | null {
  const occurrenceId = Number(item.dataset.runId);
  if (occurrenceId) {
    const toDate = list.dataset.date;
    return toDate
      ? { kind: "run", drop: { occurrenceId, toDate, index } }
      : null;
  }
  const todoId = Number(item.dataset.todoId);
  if (!todoId) return null;
  if (list.dataset.questlog !== undefined)
    return { kind: "questlog", drop: { todoId, index } };
  const toDate = list.dataset.date;
  return toDate ? { kind: "day", drop: { todoId, toDate, index } } : null;
}

/** "3 offen · 1 Std. 30 Min.": what is still open on a day; empty when nothing is. */
export function openSummary(day: WeekPlanDay): string {
  const open = openEntries(day);
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
 * is its width with the gap).
 */
export function todayScroll(
  today: ColumnSpan,
  view: { width: number; sticky: number },
): number {
  if (today.end <= view.width) return 0;
  return Math.max(0, today.start - view.sticky);
}
