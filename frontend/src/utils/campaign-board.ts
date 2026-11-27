import type { HierarchyTodo } from "../types/todo-hierarchy";
import { addDays } from "./date";
import { shortDate } from "./history";
import { hierarchyChildren, visibleHierarchy } from "./todo-hierarchy";

/*
 * The board of an opened campaign (CampaignBoard): its single quests in four
 * columns. Which column a quest stands in, in which order, and what a drop
 * from one column onto another asks of the server are decided here, once;
 * the component only shows it and writes.
 */

export type BoardColumn = "todo" | "planned" | "working" | "done";

/** The columns in board order, with their name and their calm empty line. */
export const BOARD_COLUMNS: readonly {
  key: BoardColumn;
  name: string;
  empty: string;
}[] = [
  { key: "todo", name: "To-Do", empty: "Keine offenen Quests ohne Tag." },
  { key: "planned", name: "Geplant", empty: "Keine Quest hat einen Tag." },
  {
    key: "working",
    name: "In Arbeit",
    empty: "Zieh hierher, woran du arbeitest. Eine laufende Stoppuhr bringt ihre Quest von selbst.",
  },
  { key: "done", name: "Erledigt", empty: "Noch nichts erledigt." },
];

/** The column's name, for headings and the status line. */
export function columnName(column: BoardColumn): string {
  return BOARD_COLUMNS.find((entry) => entry.key === column)!.name;
}

/** Erledigt shows this many of the newest; "Ältere zeigen" brings the rest. */
export const DONE_SHOWN = 20;

/** What decides a quest's column; the rest of the quest does not matter. */
type Placed = Pick<HierarchyTodo, "completed" | "inProgress" | "scheduledDate">;

/**
 * Erledigt when done; In Arbeit while the server says it is being worked
 * on; otherwise Geplant with a day and To-Do without one.
 */
export function columnOf(todo: Placed): BoardColumn {
  if (todo.completed) return "done";
  if (todo.inProgress) return "working";
  return todo.scheduledDate ? "planned" : "todo";
}

/** A card: a single quest, with the Questreihe it belongs to, if any. */
export type BoardCard = {
  todo: HierarchyTodo;
  /** The quest above it when that is not the campaign itself; null otherwise. */
  series: { id: number; title: string } | null;
};

/**
 * The cards of a campaign: every quest below it without quests of its own.
 * The campaign itself and its Questreihen are never cards. In the order of
 * the campaign's page (the tree), which the columns sort from.
 */
export function campaignCards(
  todos: readonly HierarchyTodo[],
  campaignId: number,
): BoardCard[] {
  const list = [...todos];
  const children = hierarchyChildren(list);
  const byId = new Map(list.map((todo) => [todo.id, todo]));
  return visibleHierarchy(list, new Set(), { under: campaignId })
    .map((row) => row.todo)
    .filter((todo) => !children.get(todo.id)?.length)
    .map((todo) => {
      const parent =
        todo.parentId !== null && todo.parentId !== campaignId
          ? byId.get(todo.parentId)
          : undefined;
      return {
        todo,
        series: parent ? { id: parent.id, title: parent.title } : null,
      };
    });
}

export type BoardOrder = {
  /** The Questlog's order (`GET /todos/backlog`), ids first to last. */
  questlog?: readonly number[];
  /** The quest whose stopwatch runs or pauses now: first in In Arbeit. */
  active?: number | null;
};

/**
 * The cards per column, each in its order:
 * - To-Do in the Questlog's order; quests it does not know (yet) after
 *   them, in the page's order;
 * - Geplant by day, then the appointments by time before the rest of the
 *   day, then the page's order (the day's own order is not in the tree);
 * - In Arbeit the quest the stopwatch is on first, then the page's order;
 * - Erledigt the newest completion first.
 */
export function boardColumns(
  cards: readonly BoardCard[],
  order: BoardOrder = {},
): Record<BoardColumn, BoardCard[]> {
  const columns: Record<BoardColumn, BoardCard[]> = {
    todo: [],
    planned: [],
    working: [],
    done: [],
  };
  for (const card of cards) columns[columnOf(card.todo)].push(card);
  const place = new Map(order.questlog?.map((id, index) => [id, index]) ?? []);
  const page = new Map(cards.map((card, index) => [card.todo.id, index]));
  const byPage = (a: BoardCard, b: BoardCard) =>
    page.get(a.todo.id)! - page.get(b.todo.id)!;
  columns.todo.sort(
    (a, b) =>
      (place.get(a.todo.id) ?? Infinity) - (place.get(b.todo.id) ?? Infinity) ||
      byPage(a, b),
  );
  columns.planned.sort(
    (a, b) =>
      compare(a.todo.scheduledDate ?? "", b.todo.scheduledDate ?? "") ||
      compare(a.todo.timeOfDay ?? "99:99", b.todo.timeOfDay ?? "99:99") ||
      byPage(a, b),
  );
  columns.working.sort(
    (a, b) =>
      Number(b.todo.id === order.active) - Number(a.todo.id === order.active) ||
      byPage(a, b),
  );
  columns.done.sort(
    (a, b) =>
      compare(b.todo.completedAt ?? "", a.todo.completedAt ?? "") ||
      b.todo.id - a.todo.id,
  );
  return columns;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * What moving a card from one column to another asks for:
 * - `plan`: a day, asked first (Geplant);
 * - `unplan`: its day taken away (To-Do);
 * - `complete`: done, with the undo toast (Erledigt).
 * `reopen`: it was done and opens again first. `setAside`: it was in work,
 * so the person answers "Als geblockt markieren?" before anything is
 * written. `start`: the person takes it into In Arbeit by hand, without a
 * stopwatch, so several quests can be in work at once.
 */
export type BoardAction =
  | { kind: "plan" | "unplan"; reopen: boolean; setAside: boolean }
  | { kind: "start"; reopen: boolean }
  | { kind: "complete" };

/**
 * The drop rules. Null where nothing happens: within a column (no manual
 * order on the board).
 */
export function dropAction(
  from: BoardColumn,
  to: BoardColumn,
): BoardAction | null {
  if (from === to) return null;
  if (to === "done") return { kind: "complete" };
  if (to === "working") return { kind: "start", reopen: from === "done" };
  return {
    kind: to === "planned" ? "plan" : "unplan",
    reopen: from === "done",
    setAside: from === "working",
  };
}

/** The live region's line after a move: "„Titel“ steht jetzt in Geplant." */
export function movedLine(title: string, column: BoardColumn): string {
  return `„${title}“ steht jetzt in ${columnName(column)}.`;
}

/** A column's spoken name with its count: "Geplant, 3 Quests". */
export function columnLabel(column: BoardColumn, count: number): string {
  return `${columnName(column)}, ${count} ${count === 1 ? "Quest" : "Quests"}`;
}

/**
 * A card's day in words: "Heute", "Morgen", "27. Nov.", for what was left
 * behind "seit 20. Nov.", with an appointment's time ("Heute, 13:00 Uhr").
 * Null without a day.
 */
export function cardDay(
  date: string | null,
  time: string | null,
  today: string,
): string | null {
  if (!date) return null;
  const day =
    date === today
      ? "Heute"
      : date === addDays(today, 1)
        ? "Morgen"
        : date < today
          ? `seit ${shortDate(date)}`
          : shortDate(date);
  return time ? `${day}, ${time} Uhr` : day;
}
