import type { HierarchyTodo } from "../types/todo-hierarchy";
import { addDays } from "./date";
import { shortDate } from "./history";
import { hierarchyChildren, visibleHierarchy } from "./todo-hierarchy";

/*
 * The board of an opened campaign (CampaignBoard): its single quests in four
 * columns. Which column a quest stands in, in which order, and what a drop
 * or a menu step asks, shows and writes are decided here, once; the
 * component only draws it, asks the questions and sends the writes.
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

/*
 * A move on the board: what a drop or a step from a card's menu means for
 * each card that travels, what must be asked first and what is shown and
 * written once everything is answered. The component asks and writes.
 */

/** What the person did, with the board as it stood at that moment. */
export type MoveRequest =
  /** A card dropped on column `to`: a marked one brings every marked card. */
  | {
      via: "drop";
      card: BoardCard;
      to: BoardColumn;
      cards: readonly BoardCard[];
      marked: ReadonlySet<number>;
    }
  /**
   * A step from the card's menu or keys. Geplant with a `date` asks no day;
   * a card already in Geplant moves to that day (or asks one).
   */
  | { via: "menu"; card: BoardCard; to: BoardColumn; date?: string }
  /** "Zurückstellen …": out of In Arbeit, the day stays. */
  | { via: "setAside"; card: BoardCard };

/** The answers given so far; each question is asked at most once a move. */
export type MoveAnswers = { blocked?: boolean; day?: string };

/** What the person is asked next, and about which quests. */
export type BoardQuestion = {
  kind: "blocked" | "day";
  todos: HierarchyTodo[];
  /** Several quests of a group: the dialog names them all. */
  group: boolean;
};

/** One server call of a card's step, in the order they are sent. */
export type BoardWrite =
  | { kind: "reopen" }
  | { kind: "setAside"; blocked: boolean }
  | { kind: "unplan" }
  /** A quest with a day moves; an appointment keeps its time. */
  | { kind: "reschedule"; day: string }
  | { kind: "plan"; day: string }
  | { kind: "start" };

/**
 * One card's finished step: `complete` goes the ring's way (undo toast),
 * `move` and `start` send their `writes` one after another.
 */
export type PlannedStep = {
  card: BoardCard;
  to: BoardColumn;
  /** What the card shows at once, before the server answers. */
  changes: Partial<HierarchyTodo>;
} & ({ kind: "complete" } | { kind: "move" | "start"; writes: BoardWrite[] });

/**
 * A move's plan. `clearMarks`: the marks go as soon as the move starts
 * (`at-once`, a marked card moved alone), once its writes start
 * (`on-write`, a group) or stay (null).
 */
export type MovePlan = {
  to: BoardColumn;
  group: boolean;
  clearMarks: "at-once" | "on-write" | null;
  /** The cards that travel, the carried one first. */
  cards: BoardCard[];
} & (
  | { question: BoardQuestion }
  | {
      question: null;
      steps: PlannedStep[];
      /** A group's status line, said before the writes; null alone. */
      line: string | null;
    }
);
/** A plan with every answer in. */
export type FinishedMove = Extract<MovePlan, { question: null }>;

/** A card's step before the answers: `day` undefined is still to ask. */
type Step = {
  card: BoardCard;
  to: BoardColumn;
  kind: "move" | "start" | "complete";
  reopen: boolean;
  setAside: boolean;
  /** The day stays as it is ("Zurückstellen …"). */
  keepDay: boolean;
  day?: string | null;
  blocked?: boolean;
};
type Move = Pick<MovePlan, "to" | "group" | "clearMarks"> & { steps: Step[] };

const needsBlocked = (step: Step) => step.setAside && step.blocked === undefined;
const needsDay = (step: Step) =>
  step.kind === "move" && !step.keepDay && step.day === undefined;

/**
 * Plans a move. Null where nothing moves. Otherwise either the next
 * question (whether the quests are blocked first, then the day; each only
 * while a step still waits for it) or, with every answer in, the steps to
 * show and write in order. `now` stamps a completion shown at once.
 */
export function planBoardMove(
  request: MoveRequest,
  answers: MoveAnswers,
  now: string,
): MovePlan | null {
  const move = moveOf(request);
  if (!move) return null;
  const steps = move.steps.map((step) => ({
    ...step,
    ...(needsBlocked(step) && { blocked: answers.blocked }),
    ...(needsDay(step) && { day: answers.day }),
  }));
  const base = {
    to: move.to,
    group: move.group,
    clearMarks: move.clearMarks,
    cards: steps.map((step) => step.card),
  };
  const asking = steps.some(needsBlocked)
    ? "blocked"
    : steps.some(needsDay)
      ? "day"
      : null;
  if (asking) {
    const todos = steps
      .filter(asking === "blocked" ? needsBlocked : needsDay)
      .map((step) => step.card.todo);
    return {
      ...base,
      question: { kind: asking, todos, group: move.group && todos.length > 1 },
    };
  }
  return {
    ...base,
    question: null,
    steps: steps.map((step) => finished(step, now)),
    line: move.group
      ? movedGroupLine(steps.length, steps.length, move.to)
      : null,
  };
}

/**
 * Which cards a request moves, each by its own drop rule. A marked card
 * dropped with others marked moves them all (cards already in the target
 * stay), the carried one first and the rest in the board's order.
 */
function moveOf(request: MoveRequest): Move | null {
  const { card } = request;
  const single = (
    step: Step | null,
    clearMarks: Move["clearMarks"] = null,
  ): Move | null =>
    step && { to: step.to, group: false, clearMarks, steps: [step] };
  if (request.via === "setAside")
    return single({
      card,
      to: card.todo.scheduledDate ? "planned" : "todo",
      kind: "move",
      reopen: false,
      setAside: true,
      keepDay: true,
    });
  if (request.via === "menu") {
    if (request.to !== "planned" || columnOf(card.todo) !== "planned")
      return single(stepFor(card, request.to, request.date));
    // Within Geplant: another day, or the same and nothing happens.
    if (request.date === card.todo.scheduledDate) return null;
    return single({
      card,
      to: "planned",
      kind: "move",
      reopen: false,
      setAside: false,
      keepDay: false,
      day: request.date,
    });
  }
  const { to, cards, marked } = request;
  if (!marked.has(card.todo.id)) return single(stepFor(card, to));
  const others = cards.filter(
    (item) => item.todo.id !== card.todo.id && marked.has(item.todo.id),
  );
  if (!others.length) return single(stepFor(card, to), "at-once");
  const steps = [card, ...others]
    .map((item) => stepFor(item, to))
    .filter((step): step is Step => step !== null);
  return steps.length
    ? { to, group: true, clearMarks: "on-write", steps }
    : null;
}

/** A card's step onto column `to` by the drop rules; null where it does nothing. */
function stepFor(card: BoardCard, to: BoardColumn, date?: string): Step | null {
  const action = dropAction(columnOf(card.todo), to);
  if (!action) return null;
  const base = { card, to, reopen: false, setAside: false, keepDay: false };
  if (action.kind === "complete") return { ...base, kind: "complete" };
  if (action.kind === "start")
    return { ...base, kind: "start", reopen: action.reopen };
  return {
    ...base,
    kind: "move",
    reopen: action.reopen,
    setAside: action.setAside,
    day: action.kind === "unplan" ? null : date,
  };
}

/** An answered step: what it shows at once and what it sends. */
function finished(step: Step, now: string): PlannedStep {
  const { card, to } = step;
  const changes = changesFor(step, now);
  if (step.kind === "complete") return { card, to, changes, kind: "complete" };
  return { card, to, changes, kind: step.kind, writes: writesFor(step) };
}

/**
 * What a step changes on screen before the server answers: done; or in
 * work and no longer blocked; or out of work with the answer to "blocked?"
 * and its new day (none in To-Do, which also drops an appointment's time).
 * Opening again clears the completion first.
 */
function changesFor(step: Step, now: string): Partial<HierarchyTodo> {
  if (step.kind === "complete") return { completed: true, completedAt: now };
  const reopened = step.reopen ? { completed: false, completedAt: null } : {};
  if (step.kind === "start")
    return { inProgress: true, blocked: false, ...reopened };
  const changes: Partial<HierarchyTodo> = { inProgress: false, ...reopened };
  if (step.blocked !== undefined) changes.blocked = step.blocked;
  if (!step.keepDay) {
    changes.scheduledDate = step.day ?? null;
    if (!step.day) changes.timeOfDay = null;
  }
  return changes;
}

/**
 * The server calls of a step, in order: open again first, then set aside
 * with the answer, then the start or the day (taken away only where there
 * is one; a quest with a day is rescheduled, one without is planned).
 */
function writesFor(step: Step): BoardWrite[] {
  const { todo } = step.card;
  const writes: BoardWrite[] = step.reopen ? [{ kind: "reopen" }] : [];
  if (step.kind === "start") return [...writes, { kind: "start" }];
  if (step.setAside)
    writes.push({ kind: "setAside", blocked: step.blocked ?? false });
  if (step.keepDay) return writes;
  if (!step.day) {
    if (todo.scheduledDate) writes.push({ kind: "unplan" });
  } else if (todo.scheduledDate)
    writes.push({ kind: "reschedule", day: step.day });
  else writes.push({ kind: "plan", day: step.day });
  return writes;
}

/**
 * A group's status line once its writes are done: how many of its cards
 * stand in the target column on the reloaded board.
 */
export function landedLine(
  plan: FinishedMove,
  cards: readonly BoardCard[],
): string {
  const landed = plan.steps.filter((step) => {
    const card = cards.find((item) => item.todo.id === step.card.todo.id);
    return card && columnOf(card.todo) === step.to;
  }).length;
  return movedGroupLine(landed, plan.steps.length, plan.to);
}

/** The live region's line after a move: "„Titel“ steht jetzt in Geplant." */
export function movedLine(title: string, column: BoardColumn): string {
  return `„${title}“ steht jetzt in ${columnName(column)}.`;
}

/**
 * The live region's line after several cards moved together: "3 Quests
 * stehen jetzt in Geplant.", or how many of them made it.
 */
export function movedGroupLine(
  landed: number,
  total: number,
  column: BoardColumn,
): string {
  if (!landed) return "";
  const name = columnName(column);
  if (landed === total)
    return `${total} Quests stehen jetzt in ${name}.`;
  return `${landed} von ${total} Quests stehen jetzt in ${name}.`;
}

/** What a carried group says on the floating card: "3 Karten". */
export function travelLabel(count: number): string {
  return `${count} Karten`;
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
