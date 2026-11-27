import type { TickTarget } from "../composables/useTicks";
import type {
  WeekPlanDay,
  WeekPlanEntry,
  WeekPlanResponse,
  WeekPlanTodoEntry,
} from "../types/week-plan";
import { clockBoundIndex } from "./day-order";
import { forecastStaysLine, runWindowLine } from "./day-drop";
import { dayLabel, fullStop } from "./history";
import {
  arrangeOpen,
  dayOrder,
  doneEntries,
  isEvent,
  isForecast,
  isMovable,
  isMovableRun,
  isSequenced,
  openEntries,
  questlogEntry,
  runMayMoveTo,
  type OpenRun,
  type OrderRef,
  type QuestlogQuest,
} from "./week-plan";

/*
 * "Move this entry there" on the Plan's read (the Plan, Heute on another
 * day): what a drop means for each kind of entry, what changes in the plan
 * data shown at once, which writes follow in which order, and the line the
 * view says. `usePlanMove` sends it; the views only pass the drop.
 */

/** A quest dropped on a day: `index` is its place among the day's open rows. */
export type Drop = { todoId: number; toDate: string; index: number };

/** A daily's stored run dropped on a day, at `index` among its open rows. */
export type RunDrop = { occurrenceId: number; toDate: string; index: number };

/**
 * A Google event dropped on a day, at `index` among its open rows. It keeps
 * its time, so it only sorts within its own day.
 */
export type EventDrop = { eventId: number; toDate: string; index: number };

/** A forecast run sorted within its day (it never moves to another). */
export type ForecastDrop = { habitId: number; toDate: string; index: number };

/** A quest dropped into the Questlog column, at `index` of its list. */
export type ShelfDrop = { todoId: number; index: number };

/**
 * A move by the kind of entry: a quest onto a day (from a day, from what was
 * left behind or from the Questlog column), a run, an event or a forecast
 * within the rules of its kind, a quest into the Questlog column, or a card
 * dropped where it may not go (the view says why).
 */
export type BoardDrop =
  | { kind: "day"; drop: Drop }
  | { kind: "run"; drop: RunDrop }
  | { kind: "event"; drop: EventDrop }
  | { kind: "forecast"; drop: ForecastDrop }
  | { kind: "refused"; reason: "forecast"; title: string }
  | { kind: "questlog"; drop: ShelfDrop };

/** A move onto a day. */
type DayMove = Extract<BoardDrop, { kind: "day" | "run" | "event" | "forecast" }>;

/**
 * How a view words a move: the Plan says where the entry now stands ("am
 * Mittwoch", "an Stelle 2 von 3"); Heute on another day sorts only within
 * that day and says the order is saved.
 */
export type MoveWords = "plan" | "day";

/** What a move works on: the plan and the Questlog column (empty without one). */
export type Board = {
  plan: WeekPlanResponse;
  backlog: readonly QuestlogQuest[];
};

/** One write of a move; `usePlanMove` sends them in the order given. */
export type MoveWrite =
  /** Reschedules a quest or run (`writeMove`); `confirmFixed` keeps an appointment's time. */
  | { type: "move"; target: TickTarget; date: string; confirmFixed: boolean }
  /** Gives a quest of the Questlog its day, with the Questlog's own save. */
  | { type: "plan"; quest: QuestlogQuest; date: string }
  /** Takes a quest's day away: it goes back into the Questlog. */
  | { type: "unplan"; todoId: number }
  | { type: "order-day"; order: OrderRef[] }
  | { type: "order-questlog"; order: number[] };

/** A move that lands: shown at once, then written; a failure takes it back. */
export type Landing = {
  plan: WeekPlanResponse;
  /** The Questlog column as shown; null when the move leaves it as it is. */
  backlog: QuestlogQuest[] | null;
  writes: MoveWrite[];
  /** The status line, read out since the card itself moved. */
  line: string;
  fallbackError: string;
};

/** A landing, a move that may not land and why, or null when nothing changes. */
export type MoveOutcome = Landing | { refused: string } | null;

/** The stopwatch-shaped target of an open quest or run, for `useTicks`. */
export function entryTarget(entry: WeekPlanTodoEntry | OpenRun): TickTarget {
  return entry.type === "todo"
    ? { kind: "todo", id: entry.todoId, title: entry.title }
    : { kind: "occurrence", id: entry.occurrenceId, title: entry.title };
}

/** The move that puts an open quest or run at `index` of the day `toDate`. */
export function dropAt(
  entry: WeekPlanTodoEntry | OpenRun,
  toDate: string,
  index: number,
): Extract<BoardDrop, { kind: "day" | "run" }> {
  return entry.type === "todo"
    ? { kind: "day", drop: { todoId: entry.todoId, toDate, index } }
    : {
        kind: "run",
        drop: { occurrenceId: entry.occurrenceId, toDate, index },
      };
}

/**
 * Why a run stays where it is when a move leaves its window: the Plan says
 * how long it may wait, Heute how far it may move (`runWindowLine`).
 */
export function windowLine(
  run: OpenRun,
  today: string,
  words: MoveWords,
): string {
  if (words === "day") return runWindowLine(run.title, run.moveUntil, today);
  return run.moveUntil
    ? fullStop(
        `„${run.title}“ kann höchstens bis ${dayLabel(run.moveUntil)} warten`,
      )
    : `„${run.title}“ bleibt an seinem Tag.`;
}

/** Whether `entry` is the open entry the move names (an event even when ticked). */
function names(move: DayMove, entry: WeekPlanEntry): boolean {
  switch (move.kind) {
    case "day":
      return isMovable(entry) && entry.todoId === move.drop.todoId;
    case "run":
      return isMovableRun(entry) && entry.occurrenceId === move.drop.occurrenceId;
    case "event":
      return isEvent(entry) && entry.eventId === move.drop.eventId;
    case "forecast":
      return (
        isForecast(entry) &&
        entry.type === "habit" &&
        entry.habitId === move.drop.habitId
      );
  }
}

/** Where the entry a move names stands now: on a day or left behind. */
type Found = { entry: WeekPlanEntry; source?: WeekPlanDay; overdue: boolean };

/**
 * The entry a move names. A quest or run is looked for in what was left
 * behind first, then on every day; an event or a forecast only on the day
 * it is dropped on, the one day it may stand on.
 */
function locate(plan: WeekPlanResponse, move: DayMove): Found | null {
  const matches = (entry: WeekPlanEntry) => names(move, entry);
  if (move.kind === "event" || move.kind === "forecast") {
    const day = plan.days.find((item) => item.date === move.drop.toDate);
    const entry = day?.entries.find(matches);
    return day && entry ? { entry, source: day, overdue: false } : null;
  }
  const left = plan.overdue.find(matches);
  if (left) return { entry: left, overdue: true };
  for (const day of plan.days) {
    const entry = day.entries.find(matches);
    if (entry) return { entry, source: day, overdue: false };
  }
  return null;
}

const withOpen = (day: WeekPlanDay, open: WeekPlanEntry[]): WeekPlanDay => ({
  ...day,
  entries: [...open, ...doneEntries(day)],
});

/** An open entry put on a day: the plan as shown, and the day's new order. */
type Placed = { plan: WeekPlanResponse; order: OrderRef[] | null };

/**
 * Puts the open `entry` at `index` of the day `toDate`, as `placed` (the
 * entry as it will stand there), held on the clock (`clockBoundIndex`). It
 * comes from the day `from.source`, from what was left behind
 * (`from.overdue`), or from nowhere (a quest of the Questlog). Returns null
 * when nothing changes or the day is past or not on the board.
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

  const before = dayOrder(openEntries(target), toDate);
  const after = dayOrder(arranged, toDate);
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

/** "„Lesen“ steht jetzt an Stelle 2 von 3.": an entry's place in its day. */
function placeLine(plan: WeekPlanResponse, move: DayMove): string {
  const day = plan.days.find(({ date }) => date === move.drop.toDate)!;
  const open = openEntries(day);
  const entry = open.find((item) => names(move, item))!;
  return `„${entry.title}“ steht jetzt an Stelle ${open.indexOf(entry) + 1} von ${
    open.length
  }.`;
}

/**
 * A move onto a day, by kind:
 * - a quest moves when dropped on a day it is not planned for (another day,
 *   any day for one left behind); an appointment keeps its time, its place
 *   bounded by the clock. A quest of the Questlog column always moves, with
 *   the Questlog's own save, and leaves the column;
 * - a run moves only within its window (from today to `moveUntil`, the rule
 *   of Heute's "Morgen"); beyond it the move is refused with `windowLine`;
 * - an event or a forecast only sorts within its own day.
 * Then the target day takes its new order, if it changed. Never into the
 * past; null when nothing changes.
 */
function onDay(board: Board, move: DayMove, words: MoveWords): MoveOutcome {
  const { plan } = board;
  const { toDate, index } = move.drop;
  const queued =
    move.kind === "day"
      ? board.backlog.find((quest) => quest.id === move.drop.todoId)
      : undefined;
  const found: Found | null = queued
    ? { entry: questlogEntry(queued, toDate), overdue: false }
    : locate(plan, move);
  if (!found) return null;
  const { entry, source, overdue } = found;

  let moves = false;
  let placed = entry;
  if (entry.type === "todo" && move.kind === "day") {
    moves = !!queued || entry.scheduledDate !== toDate;
    if (moves) placed = { ...entry, scheduledDate: toDate, isOverdue: false };
  } else if (isMovableRun(entry) && move.kind === "run") {
    moves = !source || source.date !== toDate;
    if (moves && !runMayMoveTo(entry, toDate, plan.today))
      return { refused: windowLine(entry, plan.today, words) };
    if (moves) placed = { ...entry, isOverdue: false };
  }

  const result = place(
    plan,
    entry,
    placed,
    { source, overdue, moves },
    toDate,
    index,
  );
  if (!result) {
    // A run that cannot go where it was moved says how far it may.
    return moves && isMovableRun(entry)
      ? { refused: windowLine(entry, plan.today, words) }
      : null;
  }

  const writes: MoveWrite[] = [];
  if (queued) writes.push({ type: "plan", quest: queued, date: toDate });
  else if (moves && (isMovable(entry) || isMovableRun(entry)))
    writes.push({
      type: "move",
      target: entryTarget(entry),
      date: toDate,
      confirmFixed: entry.type === "todo" && entry.timeOfDay !== null,
    });
  if (result.order) writes.push({ type: "order-day", order: result.order });

  return {
    plan: result.plan,
    backlog: queued
      ? board.backlog.filter((quest) => quest !== queued)
      : null,
    writes,
    ...wordsOf(move, words, {
      queued: !!queued,
      moved: moves,
      title: entry.title,
      plan: result.plan,
    }),
  };
}

/** The status line and the error text of a move onto a day. */
function wordsOf(
  move: DayMove,
  words: MoveWords,
  landed: {
    queued: boolean;
    moved: boolean;
    title: string;
    plan: WeekPlanResponse;
  },
): { line: string; fallbackError: string } {
  if (move.kind === "event")
    return {
      line: "Termin einsortiert, seine Uhrzeit bleibt.",
      fallbackError: "Der Termin konnte nicht einsortiert werden.",
    };
  if (move.kind === "forecast")
    return {
      line: "Daily einsortiert.",
      fallbackError: "Die Reihenfolge konnte nicht gespeichert werden.",
    };
  if (words === "day")
    return {
      line: "Reihenfolge gespeichert.",
      fallbackError: "Die Reihenfolge konnte nicht gespeichert werden.",
    };
  return {
    line: landed.moved
      ? fullStop(`„${landed.title}“ steht jetzt am ${dayLabel(move.drop.toDate)}`)
      : placeLine(landed.plan, move),
    fallbackError: landed.queued
      ? "Die Quest konnte nicht eingeplant werden."
      : move.kind === "day"
        ? "Die Quest konnte nicht verschoben werden."
        : "Das Daily konnte nicht verschoben werden.",
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
 * A quest dropped into the Questlog column: a quest of the column takes its
 * new place; a quest from a day (or one left behind) loses its day and lands
 * where it was dropped. Then the column's whole new order is stored. Dailies
 * and done quests stay; null when nothing changes.
 */
function shelve(board: Board, drop: ShelfDrop): MoveOutcome {
  const { plan, backlog } = board;
  const queued = backlog.find((quest) => quest.id === drop.todoId);
  const entry = queued
    ? undefined
    : [...plan.overdue, ...plan.days.flatMap((day) => day.entries)].find(
        (item): item is WeekPlanTodoEntry =>
          isMovable(item) && item.todoId === drop.todoId,
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
  const at = order.indexOf(quest.id);
  return {
    plan: queued ? plan : withoutQuest(plan, quest.id),
    backlog: rows,
    writes: [
      ...(queued ? [] : [{ type: "unplan" as const, todoId: quest.id }]),
      { type: "order-questlog", order },
    ],
    line: `„${quest.title}“ steht jetzt im Questlog an Stelle ${at + 1} von ${
      order.length
    }.`,
    fallbackError: queued
      ? "Die Reihenfolge konnte nicht gespeichert werden."
      : "Die Quest konnte nicht zurück in den Questlog.",
  };
}

/**
 * What a move does on the board: the plan data shown at once, the writes in
 * their order, the status line and the error text (`Landing`); a refusal
 * with the words the view says in sight (a forecast dropped on another day,
 * a run beyond its window); or null when nothing changes.
 */
export function planMove(
  board: Board,
  move: BoardDrop,
  words: MoveWords,
): MoveOutcome {
  if (move.kind === "refused") return { refused: forecastStaysLine(move.title) };
  if (move.kind === "questlog") return shelve(board, move.drop);
  return onDay(board, move, words);
}

/**
 * Where the open entry that `matches` goes in a step: up and down to the
 * next place in its day's order, left and right to the end of the shown day
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
 * Where a step takes an open quest or run of the shown days: up and down
 * ("Nach oben", "Nach unten", the arrow keys) to the next place in the
 * day's order, left and right (the arrow keys) to the end of the day before
 * or after; a run only within its window, so it never goes where Heute
 * could not move it. Null where there is no such place (the edge of the
 * board, the past, a fixed time) and for any other entry.
 */
export function stepDrop(
  plan: WeekPlanResponse,
  entry: WeekPlanEntry,
  direction: "up" | "down" | "left" | "right",
): BoardDrop | null {
  if (!isMovable(entry) && !isMovableRun(entry)) return null;
  const probe = dropAt(entry, "", 0);
  const step = stepPlace(plan, (item) => names(probe, item), direction);
  if (!step) return null;
  if (
    isMovableRun(entry) &&
    (direction === "left" || direction === "right") &&
    !runMayMoveTo(entry, step.toDate, plan.today)
  )
    return null;
  return dropAt(entry, step.toDate, step.index);
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
  const habitId = Number(item.dataset.forecastId);
  if (habitId) {
    // A forecast run sorts within its day; it is stored only there.
    const toDate = list.dataset.date;
    if (!toDate) return null;
    return toDate === item.dataset.forecastDate
      ? { kind: "forecast", drop: { habitId, toDate, index } }
      : { kind: "refused", reason: "forecast", title: item.dataset.title ?? "" };
  }
  const eventId = Number(item.dataset.eventId);
  if (eventId) {
    const toDate = list.dataset.date;
    return toDate ? { kind: "event", drop: { eventId, toDate, index } } : null;
  }
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
