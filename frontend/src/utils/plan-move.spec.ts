import { describe, expect, it } from "vitest";
import { WEEK_ENTRY_FIELDS, WEEK_HABIT_FIELDS } from "../types/fixtures";
import type {
  WeekPlanDay,
  WeekPlanEventEntry,
  WeekPlanHabitEntry,
  WeekPlanResponse,
  WeekPlanTodoEntry,
} from "../types/week-plan";
import {
  boardDrop,
  dropAt,
  planMove,
  stepDrop,
  windowLine,
  type Board,
  type BoardDrop,
  type Landing,
  type MoveWords,
  type MoveWrite,
} from "./plan-move";
import type { OpenRun, OrderRef, QuestlogQuest } from "./week-plan";
import { planRow } from "./row-actions";

const MONDAY = "2026-11-16";
const TODAY = "2026-11-17";
const WEDNESDAY = "2026-11-18";

const quest = (
  todoId: number,
  overrides: Partial<WeekPlanTodoEntry> = {},
): WeekPlanTodoEntry => ({
  ...WEEK_ENTRY_FIELDS,
  type: "todo",
  todoId,
  title: `Quest ${todoId}`,
  status: "pending",
  scheduledDate: TODAY,
  ...overrides,
});

const daily = (
  occurrenceId: number | null,
  overrides: Partial<WeekPlanHabitEntry> = {},
): WeekPlanHabitEntry => ({
  ...WEEK_ENTRY_FIELDS,
  ...WEEK_HABIT_FIELDS,
  type: "habit",
  habitId: 5,
  occurrenceId,
  title: "Laufen",
  status: "pending",
  ...overrides,
});

/** A stored run that may move until Wednesday. */
const run = (overrides: Partial<WeekPlanHabitEntry> = {}) =>
  daily(9, { moveUntil: WEDNESDAY, ...overrides }) as OpenRun;

const event = (eventId: number, timeOfDay: string): WeekPlanEventEntry => ({
  ...WEEK_ENTRY_FIELDS,
  type: "event",
  eventId,
  status: "pending",
  start: `${WEDNESDAY}T10:00:00Z`,
  end: `${WEDNESDAY}T11:00:00Z`,
  title: `Termin ${eventId}`,
  timeOfDay,
});

function week(
  days: Record<string, WeekPlanDay["entries"]>,
  overdue: WeekPlanResponse["overdue"] = [],
): WeekPlanResponse {
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${MONDAY}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
  return {
    startDate: MONDAY,
    endDate: dates[6]!,
    today: TODAY,
    days: dates.map((date) => ({ date, entries: days[date] ?? [] })),
    overdue,
  };
}

const queued = (id: number, title = `Questlog ${id}`): QuestlogQuest => ({
  id,
  title,
  plannedDurationMinutes: null,
  campaign: null,
  timerEligible: true,
});

const on = (plan: WeekPlanResponse, backlog: QuestlogQuest[] = []): Board => ({
  plan,
  backlog,
});

const titles = (plan: WeekPlanResponse, date: string) =>
  plan.days.find((day) => day.date === date)!.entries.map(({ title }) => title);

const todo = (id: number) => ({ type: "todo" as const, id });
const habit = (id: number) => ({ type: "habit" as const, id });
const order = (...items: OrderRef[]): MoveWrite => ({
  type: "order-day",
  order: items,
});
const moveQuest = (id: number, date: string, confirmFixed = false): MoveWrite => ({
  type: "move",
  target: { kind: "todo", targetId: id, title: `Quest ${id}` },
  date,
  confirmFixed,
});
const moveRun = (date: string): MoveWrite => ({
  type: "move",
  target: { kind: "occurrence", targetId: 9, title: "Laufen" },
  date,
  confirmFixed: false,
});
const day = (todoId: number, toDate: string, index: number): BoardDrop => ({
  kind: "day",
  drop: { todoId, toDate, index },
});
const runTo = (toDate: string, index: number): BoardDrop => ({
  kind: "run",
  drop: { occurrenceId: 9, toDate, index },
});
const shelf = (todoId: number, index: number): BoardDrop => ({
  kind: "questlog",
  drop: { todoId, index },
});

const QUEST_FAILED = "Die Quest konnte nicht verschoben werden.";
const RUN_FAILED = "Das Daily konnte nicht verschoben werden.";
const ORDER_FAILED = "Die Reihenfolge konnte nicht gespeichert werden.";

const SORTED_DAY = week({ [TODAY]: [quest(1), quest(2), quest(3)] });
const RUN_TODAY = week({ [TODAY]: [quest(1), run()] });
const LEFT_BEHIND = week({ [TODAY]: [quest(2)] }, [
  quest(1, { isOverdue: true, scheduledDate: MONDAY }),
  daily(4, { isOverdue: true }),
]);
const FROM_QUESTLOG = on(
  week({ [WEDNESDAY]: [quest(2, { scheduledDate: WEDNESDAY })] }),
  [{ ...queued(7, "Neu"), plannedDurationMinutes: 20 }, queued(8)],
);
const SHELVES = week(
  { [WEDNESDAY]: [quest(5, { scheduledDate: WEDNESDAY })] },
  [quest(6, { isOverdue: true, scheduledDate: MONDAY })],
);

describe("planMove: a move that lands", () => {
  const cases: {
    name: string;
    board: Board;
    move: BoardDrop;
    words?: MoveWords;
    writes: MoveWrite[];
    line: string;
    fallbackError: string;
    shown?: (landing: Landing, board: Board) => void;
  }[] = [
    {
      name: "a quest sorted within its day",
      board: on(SORTED_DAY),
      move: day(3, TODAY, 0),
      writes: [order(todo(3), todo(1), todo(2))],
      line: "„Quest 3“ steht jetzt an Stelle 1 von 3.",
      fallbackError: QUEST_FAILED,
      shown: (landing) => {
        expect(titles(landing.plan, TODAY)).toEqual(["Quest 3", "Quest 1", "Quest 2"]);
        expect(landing.backlog).toBeNull();
      },
    },
    {
      name: "a quest moved to another day, where it was dropped",
      board: on(
        week({
          [TODAY]: [quest(1), quest(2)],
          [WEDNESDAY]: [quest(3, { scheduledDate: WEDNESDAY }), daily(9)],
        }),
      ),
      move: day(2, WEDNESDAY, 1),
      writes: [
        moveQuest(2, WEDNESDAY),
        order(todo(3), todo(2), habit(9)),
      ],
      line: "„Quest 2“ steht jetzt bei morgen.",
      fallbackError: QUEST_FAILED,
      shown: (landing) => {
        expect(titles(landing.plan, TODAY)).toEqual(["Quest 1"]);
        expect(titles(landing.plan, WEDNESDAY)).toEqual(["Quest 3", "Quest 2", "Laufen"]);
      },
    },
    {
      name: "an appointment moved with its time confirmed",
      board: on(
        week({
          [TODAY]: [quest(1, { timeOfDay: "10:00" })],
          [WEDNESDAY]: [quest(2, { scheduledDate: WEDNESDAY })],
        }),
      ),
      move: day(1, WEDNESDAY, 1),
      writes: [moveQuest(1, WEDNESDAY, true), order(todo(2), todo(1))],
      line: "„Quest 1“ steht jetzt bei morgen.",
      fallbackError: QUEST_FAILED,
      shown: (landing) =>
        expect(titles(landing.plan, WEDNESDAY)).toEqual(["Quest 2", "Quest 1"]),
    },
    {
      name: "a quest left behind, planned for the day it is dropped on",
      board: on(LEFT_BEHIND),
      move: day(1, TODAY, 1),
      writes: [moveQuest(1, TODAY), order(todo(2), todo(1))],
      line: "„Quest 1“ steht jetzt bei heute.",
      fallbackError: QUEST_FAILED,
      shown: (landing) => {
        expect(landing.plan.overdue.map(({ title }) => title)).toEqual(["Laufen"]);
        expect(titles(landing.plan, TODAY)).toEqual(["Quest 2", "Quest 1"]);
        expect(landing.plan.days[1]!.entries[1]).toMatchObject({
          isOverdue: false,
          scheduledDate: TODAY,
        });
      },
    },
    {
      name: "a quest of the Questlog column, planned with the Questlog's save",
      board: FROM_QUESTLOG,
      move: day(7, WEDNESDAY, 1),
      writes: [
        { type: "plan", quest: FROM_QUESTLOG.backlog[0]!, date: WEDNESDAY },
        order(todo(2), todo(7)),
      ],
      line: "„Neu“ steht jetzt bei morgen.",
      fallbackError: "Die Quest konnte nicht eingeplant werden.",
      shown: (landing) => {
        expect(titles(landing.plan, WEDNESDAY)).toEqual(["Quest 2", "Neu"]);
        expect(landing.backlog!.map(({ id }) => id)).toEqual([8]);
      },
    },
    {
      name: "a run sorted within its day",
      board: on(RUN_TODAY),
      move: runTo(TODAY, 0),
      writes: [order(habit(9), todo(1))],
      line: "„Laufen“ steht jetzt an Stelle 1 von 2.",
      fallbackError: RUN_FAILED,
      shown: (landing) =>
        expect(titles(landing.plan, TODAY)).toEqual(["Laufen", "Quest 1"]),
    },
    {
      name: "a run moved within its window",
      board: on(week({ [TODAY]: [run()] })),
      move: runTo(WEDNESDAY, 0),
      writes: [moveRun(WEDNESDAY), order(habit(9))],
      line: "„Laufen“ steht jetzt bei morgen.",
      fallbackError: RUN_FAILED,
    },
    {
      name: "a run left behind, moved onto today",
      board: on(week({}, [run({ isOverdue: true })])),
      move: runTo(TODAY, 0),
      writes: [moveRun(TODAY), order(habit(9))],
      line: "„Laufen“ steht jetzt bei heute.",
      fallbackError: RUN_FAILED,
      shown: (landing) => expect(landing.plan.overdue).toEqual([]),
    },
    {
      name: "a Google event sorted among the cards without a time",
      board: on(
        week({
          [WEDNESDAY]: [
            event(9, "11:00"),
            quest(1, { scheduledDate: WEDNESDAY }),
            quest(2, { scheduledDate: WEDNESDAY }),
          ],
        }),
      ),
      move: { kind: "event", drop: { eventId: 9, toDate: WEDNESDAY, index: 2 } },
      writes: [order(todo(1), todo(2), { type: "event", id: 9 })],
      line: "Termin einsortiert, seine Uhrzeit bleibt.",
      fallbackError: "Der Termin konnte nicht einsortiert werden.",
      shown: (landing) =>
        expect(titles(landing.plan, WEDNESDAY)).toEqual(["Quest 1", "Quest 2", "Termin 9"]),
    },
    {
      name: "a Google event that never passes an appointment",
      board: on(
        week({
          [WEDNESDAY]: [
            event(9, "11:00"),
            quest(1, { scheduledDate: WEDNESDAY }),
            quest(3, { scheduledDate: WEDNESDAY, timeOfDay: "13:00" }),
          ],
        }),
      ),
      move: { kind: "event", drop: { eventId: 9, toDate: WEDNESDAY, index: 2 } },
      writes: [order(todo(1), { type: "event", id: 9 }, todo(3))],
      line: "Termin einsortiert, seine Uhrzeit bleibt.",
      fallbackError: "Der Termin konnte nicht einsortiert werden.",
      shown: (landing) =>
        expect(titles(landing.plan, WEDNESDAY)).toEqual(["Quest 1", "Termin 9", "Quest 3"]),
    },
    {
      name: "a forecast run sorted within its day, its place written with the day",
      board: on(
        week({
          [WEDNESDAY]: [
            quest(1, { scheduledDate: WEDNESDAY }),
            quest(2, { scheduledDate: WEDNESDAY }),
            daily(null, { title: "Lesen" }),
          ],
        }),
      ),
      move: { kind: "forecast", drop: { habitId: 5, toDate: WEDNESDAY, index: 1 } },
      writes: [
        order(todo(1), { type: "forecast", id: 5, date: WEDNESDAY }, todo(2)),
      ],
      line: "Daily einsortiert.",
      fallbackError: ORDER_FAILED,
      shown: (landing) =>
        expect(titles(landing.plan, WEDNESDAY)).toEqual(["Quest 1", "Lesen", "Quest 2"]),
    },
    {
      name: "Heute on another day: a quest sorted, the order saved",
      board: on(SORTED_DAY),
      move: day(3, TODAY, 0),
      words: "day",
      writes: [order(todo(3), todo(1), todo(2))],
      line: "Reihenfolge gespeichert.",
      fallbackError: ORDER_FAILED,
    },
    {
      name: "Heute on another day: a run sorted, the order saved",
      board: on(RUN_TODAY),
      move: runTo(TODAY, 0),
      words: "day",
      writes: [order(habit(9), todo(1))],
      line: "Reihenfolge gespeichert.",
      fallbackError: ORDER_FAILED,
    },
    {
      name: "the Questlog column sorted, its whole order stored",
      board: on(week({}), [queued(1), queued(2), queued(3)]),
      move: shelf(3, 0),
      writes: [{ type: "order-questlog", order: [3, 1, 2] }],
      line: "„Questlog 3“ steht jetzt im Questlog an Stelle 1 von 3.",
      fallbackError: ORDER_FAILED,
      shown: (landing, board) => {
        expect(landing.plan).toBe(board.plan);
        expect(landing.backlog!.map(({ id }) => id)).toEqual([3, 1, 2]);
      },
    },
    {
      name: "a quest off its day, back into the Questlog where it was dropped",
      board: on(SHELVES, [queued(1), queued(2)]),
      move: shelf(5, 1),
      writes: [
        { type: "unplan", todoId: 5 },
        { type: "order-questlog", order: [1, 5, 2] },
      ],
      line: "„Quest 5“ steht jetzt im Questlog an Stelle 2 von 3.",
      fallbackError: "Die Quest konnte nicht zurück in den Questlog.",
      shown: (landing) => {
        expect(landing.backlog![1]).toMatchObject({ id: 5, title: "Quest 5" });
        expect(titles(landing.plan, WEDNESDAY)).toEqual([]);
      },
    },
    {
      name: "a quest left behind, back into the Questlog",
      board: on(SHELVES),
      move: shelf(6, 4),
      writes: [
        { type: "unplan", todoId: 6 },
        { type: "order-questlog", order: [6] },
      ],
      line: "„Quest 6“ steht jetzt im Questlog an Stelle 1 von 1.",
      fallbackError: "Die Quest konnte nicht zurück in den Questlog.",
      shown: (landing) => expect(landing.plan.overdue).toEqual([]),
    },
  ];

  it.each(cases)("$name", ({ board, move, words, writes, line, fallbackError, shown }) => {
    const landing = planMove(board, move, words ?? "plan") as Landing;
    expect(landing).not.toBeNull();
    expect("refused" in landing).toBe(false);
    expect(landing.writes).toEqual(writes);
    expect(landing.line).toBe(line);
    expect(landing.fallbackError).toBe(fallbackError);
    shown?.(landing, board);
  });
});

describe("planMove: a move that may not land says why", () => {
  it.each([
    {
      name: "a forecast dropped on another day",
      board: on(week({})),
      move: { kind: "refused", reason: "forecast", title: "Lesen" } as BoardDrop,
      words: "plan" as MoveWords,
      line: "„Lesen“ ist erst eingeplant und bleibt an seinem Tag. Sortieren lässt es sich dort.",
    },
    {
      name: "a run beyond its window, on the Plan",
      board: on(week({ [TODAY]: [run()] })),
      move: runTo("2026-11-19", 0),
      words: "plan" as MoveWords,
      line: "„Laufen“ kann höchstens bis Mittwoch, 18. Nov. warten.",
    },
    {
      name: "a run that may not move at all, on the Plan",
      board: on(week({ [TODAY]: [run({ moveUntil: null })] })),
      move: runTo(WEDNESDAY, 0),
      words: "plan" as MoveWords,
      line: "„Laufen“ bleibt an seinem Tag.",
    },
    {
      name: "a run beyond its window, in Heute's words",
      board: on(week({ [TODAY]: [run()] })),
      move: runTo("2026-11-19", 0),
      words: "day" as MoveWords,
      line: "„Laufen“ lässt sich nur bis Mittwoch, 18. Nov. verschieben.",
    },
  ])("$name", ({ board, move, words, line }) => {
    expect(planMove(board, move, words)).toEqual({ refused: line });
  });
});

describe("planMove: a move that changes nothing", () => {
  const done = week({ [TODAY]: [quest(1), quest(2, { status: "completed" })] });
  const appointment = week({
    [TODAY]: [quest(1, { timeOfDay: "10:00" })],
    [WEDNESDAY]: [quest(2, { scheduledDate: WEDNESDAY })],
  });
  it.each([
    { name: "a quest into the past", board: on(done), move: day(1, MONDAY, 0) },
    { name: "a done quest", board: on(done), move: day(2, TODAY, 0) },
    { name: "a quest onto its own place", board: on(done), move: day(1, TODAY, 0) },
    { name: "an appointment onto its own day", board: on(appointment), move: day(1, TODAY, 0) },
    { name: "a quest of the Questlog into the past", board: FROM_QUESTLOG, move: day(7, MONDAY, 0) },
    { name: "a run onto its own place", board: on(week({ [TODAY]: [run()] })), move: runTo(TODAY, 0) },
    {
      name: "a Google event onto another day",
      board: on(week({ [WEDNESDAY]: [event(9, "11:00")] })),
      move: { kind: "event", drop: { eventId: 9, toDate: TODAY, index: 0 } } as BoardDrop,
    },
    {
      name: "a quest of the column onto its own place",
      board: on(week({}), [queued(1), queued(2), queued(3)]),
      move: shelf(2, 1),
    },
    {
      name: "a daily into the column",
      board: on(week({ [TODAY]: [daily(8), quest(9, { status: "completed" })] })),
      move: shelf(8, 0),
    },
    {
      name: "a done quest into the column",
      board: on(week({ [TODAY]: [daily(8), quest(9, { status: "completed" })] })),
      move: shelf(9, 0),
    },
  ])("$name", ({ board, move }) => {
    expect(planMove(board, move, "plan")).toBeNull();
  });
});

describe("stepDrop", () => {
  const sorted = week({
    [MONDAY]: [],
    [TODAY]: [quest(1, { timeOfDay: "09:00" }), quest(2), quest(3)],
  });
  const withRun = week({ [TODAY]: [quest(1), run()] });
  const entry = (plan: WeekPlanResponse, key: number | "run") =>
    plan.days
      .flatMap((item) => item.entries)
      .find((item) =>
        key === "run" ? item.type === "habit" : item.type === "todo" && item.todoId === key,
      )!;

  it.each([
    { name: "a quest one place up", plan: sorted, key: 3, direction: "up", drop: day(3, TODAY, 1) },
    { name: "not past the end", plan: sorted, key: 3, direction: "down", drop: null },
    { name: "an appointment down past the next card", plan: sorted, key: 1, direction: "down", drop: day(1, TODAY, 1) },
    { name: "a card up past an appointment", plan: sorted, key: 2, direction: "up", drop: day(2, TODAY, 0) },
    { name: "to the end of the next day", plan: sorted, key: 2, direction: "right", drop: day(2, WEDNESDAY, 0) },
    { name: "never into the past", plan: sorted, key: 2, direction: "left", drop: null },
    { name: "an appointment to the next day too", plan: sorted, key: 1, direction: "right", drop: day(1, WEDNESDAY, 0) },
    { name: "a run up", plan: withRun, key: "run", direction: "up", drop: runTo(TODAY, 0) },
    { name: "a run not past the end", plan: withRun, key: "run", direction: "down", drop: null },
    { name: "a run within its window", plan: withRun, key: "run", direction: "right", drop: runTo(WEDNESDAY, 0) },
    { name: "a run never into the past", plan: withRun, key: "run", direction: "left", drop: null },
    {
      name: "a run never beyond its window",
      plan: week({ [WEDNESDAY]: [run()] }),
      key: "run",
      direction: "right",
      drop: null,
    },
  ] as const)("$name", ({ plan, key, direction, drop }) => {
    expect(stepDrop(plan, entry(plan, key), direction)).toEqual(drop);
  });

  it("steps nothing but open quests and runs", () => {
    const plan = week({
      [TODAY]: [quest(1), quest(2, { status: "completed" }), event(9, "11:00")],
    });
    expect(stepDrop(plan, plan.days[1]!.entries[1]!, "up")).toBeNull();
    expect(stepDrop(plan, plan.days[1]!.entries[2]!, "up")).toBeNull();
  });

  it("gives the order the step lands on", () => {
    const up = stepDrop(sorted, entry(sorted, 3), "up")!;
    expect((planMove(on(sorted), up, "plan") as Landing).writes).toEqual([
      order(todo(1), todo(3), todo(2)),
    ]);
    const past = stepDrop(sorted, entry(sorted, 2), "up")!;
    expect((planMove(on(sorted), past, "plan") as Landing).writes).toEqual([
      order(todo(2), todo(1), todo(3)),
    ]);
  });
});

describe("dropAt and windowLine", () => {
  it("names a quest or a run the way a drop does", () => {
    expect(dropAt(planRow(quest(3), null), WEDNESDAY, 2)).toEqual(
      day(3, WEDNESDAY, 2),
    );
    expect(dropAt(planRow(run(), null), WEDNESDAY, 0)).toEqual(
      runTo(WEDNESDAY, 0),
    );
  });

  it("says how far a run may go in each view's words", () => {
    expect(windowLine(run(), TODAY, "plan")).toBe(
      "„Laufen“ kann höchstens bis Mittwoch, 18. Nov. warten.",
    );
    expect(windowLine(run({ moveUntil: null }), TODAY, "plan")).toBe(
      "„Laufen“ bleibt an seinem Tag.",
    );
    expect(windowLine(run({ moveUntil: TODAY }), TODAY, "day")).toBe(
      "„Laufen“ lässt sich nur bis heute verschieben.",
    );
  });
});

describe("boardDrop", () => {
  const element = (data: Record<string, string>) => {
    const node = document.createElement("li");
    Object.assign(node.dataset, data);
    return node;
  };

  it("reads a drop on a day or into the Questlog column from the list", () => {
    const card = element({ todoId: "4" });
    expect(boardDrop(card, element({ date: WEDNESDAY }), 2)).toEqual({
      kind: "day",
      drop: { todoId: 4, toDate: WEDNESDAY, index: 2 },
    });
    expect(boardDrop(card, element({ questlog: "" }), 0)).toEqual({
      kind: "questlog",
      drop: { todoId: 4, index: 0 },
    });
  });

  it("reads a run's drop on a day, never into the Questlog", () => {
    const card = element({ runId: "9" });
    expect(boardDrop(card, element({ date: WEDNESDAY }), 1)).toEqual({
      kind: "run",
      drop: { occurrenceId: 9, toDate: WEDNESDAY, index: 1 },
    });
    expect(boardDrop(card, element({ questlog: "" }), 0)).toBeNull();
  });

  it("ignores a forecast and the column of what was left behind", () => {
    expect(boardDrop(element({}), element({ date: TODAY }), 0)).toBeNull();
    expect(boardDrop(element({ todoId: "4" }), element({}), 0)).toBeNull();
  });
});
