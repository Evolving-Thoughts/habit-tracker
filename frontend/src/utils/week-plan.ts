import type { TodoResponse } from "../types/todo";
import type {
  WeekPlanDay,
  WeekPlanEntry,
  WeekPlanResponse,
  WeekPlanTodoEntry,
} from "../types/week-plan";
import { addDays, isValidIsoDate, weekStart } from "./date";
import { formatDuration } from "./today-agenda";

/** How the server names an item of a day's order (PUT /day-planner/order). */
export type OrderRef = { type: "todo" | "habit"; id: number };

/** A quest dropped on a day: `index` is its place among the day's open rows. */
export type Drop = { todoId: number; toDate: string; index: number };

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

/** The Monday of the week in the address, or of `today` when it is unusable. */
export function weekFromQuery(value: unknown, today: string): string {
  return typeof value === "string" && isValidIsoDate(value)
    ? weekStart(value)
    : weekStart(today);
}

/** A key unique on the board; quests keep the key Heute uses. */
export function entryKey(entry: WeekPlanEntry, date: string): string {
  if (entry.type === "todo") return `todo-${entry.todoId}`;
  return entry.occurrenceId === null
    ? `forecast-${entry.habitId}-${date}`
    : `habit-${entry.occurrenceId}`;
}

/** Only open quests can be dragged or moved; dailies are fixed rows. */
export function isMovable(entry: WeekPlanEntry): entry is WeekPlanTodoEntry {
  return entry.type === "todo" && entry.status === "pending";
}

export function openEntries(day: WeekPlanDay): WeekPlanEntry[] {
  return day.entries.filter((entry) => entry.status === "pending");
}

export function doneEntries(day: WeekPlanDay): WeekPlanEntry[] {
  return day.entries.filter((entry) => entry.status !== "pending");
}

/**
 * Whether an entry takes part in the day's stored order: not anchored by the
 * clock, not carried over from an earlier day, and stored on the server.
 */
function isSequenced(entry: WeekPlanEntry): boolean {
  if (entry.status !== "pending" || entry.timeOfDay !== null) return false;
  if (entry.isOverdue) return false;
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
 * the sequenced ones in the order given: carried-over items first, then the
 * clock, then the order of the day, then forecast dailies, which have none.
 */
export function arrangeOpen(open: readonly WeekPlanEntry[]): WeekPlanEntry[] {
  const carried = open.filter((entry) => entry.isOverdue);
  const timed = open
    .filter((entry) => !carried.includes(entry) && entry.timeOfDay !== null)
    .sort((first, second) => first.timeOfDay!.localeCompare(second.timeOfDay!));
  const sequenced = open.filter(isSequenced);
  const rest = open.filter(
    (entry) =>
      !carried.includes(entry) && !timed.includes(entry) && !isSequenced(entry),
  );
  return [...carried, ...timed, ...sequenced, ...rest];
}

const withOpen = (day: WeekPlanDay, open: WeekPlanEntry[]): WeekPlanDay => ({
  ...day,
  entries: [...open, ...doneEntries(day)],
});

/**
 * Applies a drop to the plan at once and says what to write. Dropped on a
 * day it is not planned for (another day, or today for an overdue quest),
 * the quest moves there; an untimed quest then takes its place in that
 * day's order. Returns null when the drop changes nothing.
 *
 * `incoming` is a quest from the Questlog column: it has no day yet, so it
 * comes from no column of the board and always moves.
 */
export function dropOnDay(
  plan: WeekPlanResponse,
  drop: Drop,
  incoming?: WeekPlanTodoEntry,
): { plan: WeekPlanResponse; write: DropWrite } | null {
  const source = incoming
    ? undefined
    : plan.days.find((day) =>
        day.entries.some(
          (entry) => entry.type === "todo" && entry.todoId === drop.todoId,
        ),
      );
  const target = plan.days.find((day) => day.date === drop.toDate);
  const entry =
    incoming ??
    source?.entries.find(
      (item): item is WeekPlanTodoEntry =>
        item.type === "todo" && item.todoId === drop.todoId,
    );
  if ((!source && !incoming) || !target || !entry || !isMovable(entry))
    return null;
  if (drop.toDate < plan.today) return null;

  const moves = !!incoming || entry.scheduledDate !== drop.toDate;
  const placed: WeekPlanTodoEntry = moves
    ? { ...entry, scheduledDate: drop.toDate, isOverdue: false }
    : entry;
  const rows = openEntries(target).filter((item) => item !== entry);
  const index = Math.max(0, Math.min(drop.index, rows.length));
  rows.splice(index, 0, placed);
  const arranged = arrangeOpen(rows);

  const before = dayOrder(openEntries(target));
  const after = dayOrder(arranged);
  const sorted =
    placed.timeOfDay === null &&
    (moves || JSON.stringify(before) !== JSON.stringify(after));
  if (!moves && !sorted) return null;

  return {
    plan: {
      ...plan,
      days: plan.days.map((day) => {
        if (day === target) return withOpen(day, arranged);
        if (day === source)
          return withOpen(
            day,
            openEntries(day).filter((item) => item !== entry),
          );
        return day;
      }),
    },
    write: {
      todoId: entry.todoId,
      moveTo: moves ? drop.toDate : null,
      confirmFixed: entry.timeOfDay !== null,
      order: sorted ? after : null,
    },
  };
}

/**
 * Where the grip's arrow keys take a quest: up and down to the next place
 * in the day's order, left and right to the end of the day before or after.
 * Returns null where there is no such place (the edge, the past, a time).
 */
export function arrowDrop(
  plan: WeekPlanResponse,
  todoId: number,
  key: "up" | "down" | "left" | "right",
): Drop | null {
  const dayIndex = plan.days.findIndex((day) =>
    openEntries(day).some(
      (entry) => entry.type === "todo" && entry.todoId === todoId,
    ),
  );
  const day = plan.days[dayIndex];
  if (!day) return null;
  const open = openEntries(day);
  const entry = open.find(
    (item) => item.type === "todo" && item.todoId === todoId,
  )!;
  if (key === "left" || key === "right") {
    const next = plan.days[dayIndex + (key === "left" ? -1 : 1)];
    if (!next || next.date < plan.today) return null;
    return { todoId, toDate: next.date, index: openEntries(next).length };
  }
  if (!isSequenced(entry)) return null;
  const sequence = open.filter(isSequenced);
  const neighbour = sequence[sequence.indexOf(entry) + (key === "up" ? -1 : 1)];
  if (!neighbour) return null;
  return { todoId, toDate: day.date, index: open.indexOf(neighbour) };
}

/**
 * A quest of the Questlog as a row of the board, so the column shows it like
 * the days do and a drop can place it before the server answers.
 */
export function questlogEntry(
  todo: Pick<
    TodoResponse,
    "id" | "title" | "plannedDurationMinutes" | "campaign"
  >,
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

/** The weeks before and after, for the switcher. */
export function neighbourWeek(start: string, direction: -1 | 1): string {
  return addDays(start, direction * 7);
}
