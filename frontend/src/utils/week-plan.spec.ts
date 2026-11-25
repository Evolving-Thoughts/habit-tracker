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
  arrangeOpen,
  boardColumns,
  boardDrop,
  dayOrder,
  dropOnDay,
  dropEventOnDay,
  dropRunOnDay,
  entryKey,
  firstDayFromQuery,
  fittingDays,
  openSummary,
  planQuery,
  planQueryFromWeek,
  questlogEntry,
  questlogStartsOpen,
  shelveQuest,
  shiftedStart,
  stepDrop,
  stepRunDrop,
  todayScroll,
  planChips,
  startColumn,
  columnAt,
  type QuestlogQuest,
} from "./week-plan";

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

const titles = (plan: WeekPlanResponse, date: string) =>
  plan.days.find((day) => day.date === date)!.entries.map(({ title }) => title);

describe("firstDayFromQuery", () => {
  it("takes a day after today from the address", () => {
    expect(firstDayFromQuery("2026-11-24", TODAY)).toBe("2026-11-24");
  });

  it("starts at today for today, the past and anything unusable", () => {
    expect(firstDayFromQuery(TODAY, TODAY)).toBe(TODAY);
    expect(firstDayFromQuery(MONDAY, TODAY)).toBe(TODAY);
    expect(firstDayFromQuery("2026-02-30", TODAY)).toBe(TODAY);
    expect(firstDayFromQuery(["2026-11-24"], TODAY)).toBe(TODAY);
    expect(firstDayFromQuery(undefined, TODAY)).toBe(TODAY);
  });
});

describe("planQuery and planQueryFromWeek", () => {
  it("keeps today on the plain address", () => {
    expect(planQuery(TODAY, TODAY)).toEqual({});
    expect(planQuery("2026-11-24", TODAY)).toEqual({ ab: "2026-11-24" });
  });

  it("sends an old week link to the first day of that week still ahead", () => {
    expect(planQueryFromWeek("2026-11-23", TODAY)).toEqual({ ab: "2026-11-23" });
    expect(planQueryFromWeek("2026-11-25", TODAY)).toEqual({ ab: "2026-11-23" });
    expect(planQueryFromWeek(MONDAY, TODAY)).toEqual({});
    expect(planQueryFromWeek("2026-11-09", TODAY)).toEqual({});
    expect(planQueryFromWeek("kaputt", TODAY)).toEqual({});
  });
});

describe("shiftedStart", () => {
  it("steps by the days shown, never before today", () => {
    expect(shiftedStart(TODAY, 4, 1, TODAY)).toBe("2026-11-21");
    expect(shiftedStart("2026-11-21", 4, -1, TODAY)).toBe(TODAY);
    expect(shiftedStart("2026-11-19", 4, -1, TODAY)).toBe(TODAY);
    expect(shiftedStart("2026-11-29", 4, -1, TODAY)).toBe("2026-11-25");
  });
});

describe("entryKey", () => {
  it("keeps the key Heute uses for quests and stored runs", () => {
    expect(entryKey(quest(3), TODAY)).toBe("todo-3");
    expect(entryKey(daily(8), TODAY)).toBe("habit-8");
  });

  it("tells forecast runs of the same daily apart by day", () => {
    expect(entryKey(daily(null), TODAY)).not.toBe(
      entryKey(daily(null), WEDNESDAY),
    );
  });
});

describe("dayOrder", () => {
  it("names what the day's stored order holds: appointments too, no forecast", () => {
    expect(
      dayOrder([
        quest(2, { timeOfDay: "09:00" }),
        quest(3),
        daily(7),
        daily(null),
      ]),
    ).toEqual([
      { type: "todo", id: 2 },
      { type: "todo", id: 3 },
      { type: "habit", id: 7 },
    ]);
  });
});

describe("arrangeOpen", () => {
  it("anchors forecast appointments by clock while sending only stored positions", () => {
    const early = daily(null, { timeOfDay: "09:00" });
    const late = daily(null, { timeOfDay: "16:00" });
    const noon = quest(2, { timeOfDay: "12:00" });
    const first = quest(1);
    const last = quest(3);
    const arranged = arrangeOpen([first, noon, last, late, early]);
    expect(arranged).toEqual([early, first, noon, late, last]);
    expect(dayOrder(arranged)).toEqual(dayOrder([first, noon, last]));
  });

  it("sorts like the server: the order with appointments on the clock, then forecasts", () => {
    expect(
      arrangeOpen([
        daily(null, { title: "Vorhersage" }),
        quest(1),
        quest(2, { timeOfDay: "14:00" }),
        quest(4, { timeOfDay: "08:00" }),
        quest(5),
      ]).map(({ title }) => title),
    ).toEqual(["Quest 1", "Quest 4", "Quest 2", "Quest 5", "Vorhersage"]);
  });
});

describe("dropOnDay", () => {
  it("sorts within a day without moving the quest", () => {
    const plan = week({ [TODAY]: [quest(1), quest(2), quest(3)] });
    const result = dropOnDay(plan, { todoId: 3, toDate: TODAY, index: 0 })!;

    expect(titles(result.plan, TODAY)).toEqual(["Quest 3", "Quest 1", "Quest 2"]);
    expect(result.write).toEqual({
      todoId: 3,
      moveTo: null,
      confirmFixed: false,
      order: [
        { type: "todo", id: 3 },
        { type: "todo", id: 1 },
        { type: "todo", id: 2 },
      ],
    });
  });

  it("moves a quest to another day and puts it where it was dropped", () => {
    const plan = week({
      [TODAY]: [quest(1), quest(2)],
      [WEDNESDAY]: [quest(3, { scheduledDate: WEDNESDAY }), daily(9)],
    });
    const result = dropOnDay(plan, { todoId: 2, toDate: WEDNESDAY, index: 1 })!;

    expect(titles(result.plan, TODAY)).toEqual(["Quest 1"]);
    expect(titles(result.plan, WEDNESDAY)).toEqual(["Quest 3", "Quest 2", "Laufen"]);
    expect(result.write).toMatchObject({
      moveTo: WEDNESDAY,
      order: [
        { type: "todo", id: 3 },
        { type: "todo", id: 2 },
        { type: "habit", id: 9 },
      ],
    });
  });

  it("keeps an appointment on its time and puts it where it was dropped", () => {
    const plan = week({
      [TODAY]: [quest(1, { timeOfDay: "10:00" })],
      [WEDNESDAY]: [quest(2, { scheduledDate: WEDNESDAY })],
    });
    const result = dropOnDay(plan, { todoId: 1, toDate: WEDNESDAY, index: 1 })!;

    expect(titles(result.plan, WEDNESDAY)).toEqual(["Quest 2", "Quest 1"]);
    expect(result.write).toEqual({
      todoId: 1,
      moveTo: WEDNESDAY,
      confirmFixed: true,
      order: [
        { type: "todo", id: 2 },
        { type: "todo", id: 1 },
      ],
    });
    expect(
      dropOnDay(plan, { todoId: 1, toDate: TODAY, index: 0 }),
    ).toBeNull();
  });

  it("plans a quest left behind for the day it is dropped on", () => {
    const plan = week({ [TODAY]: [quest(2)] }, [
      quest(1, { isOverdue: true, scheduledDate: MONDAY }),
      daily(4, { isOverdue: true }),
    ]);
    const result = dropOnDay(plan, { todoId: 1, toDate: TODAY, index: 1 })!;
    expect(result.write).toMatchObject({
      moveTo: TODAY,
      order: [
        { type: "todo", id: 2 },
        { type: "todo", id: 1 },
      ],
    });
    expect(result.plan.overdue.map(({ title }) => title)).toEqual(["Laufen"]);
    expect(titles(result.plan, TODAY)).toEqual(["Quest 2", "Quest 1"]);
    expect(result.plan.days[1]!.entries[1]).toMatchObject({
      isOverdue: false,
      scheduledDate: TODAY,
    });
  });

  it("refuses the past, done quests and drops that change nothing", () => {
    const plan = week({
      [TODAY]: [quest(1), quest(2, { status: "completed" })],
    });
    expect(dropOnDay(plan, { todoId: 1, toDate: MONDAY, index: 0 })).toBeNull();
    expect(dropOnDay(plan, { todoId: 2, toDate: TODAY, index: 0 })).toBeNull();
    expect(dropOnDay(plan, { todoId: 1, toDate: TODAY, index: 0 })).toBeNull();
  });

  it("places a quest from the Questlog column, which comes from no day", () => {
    const plan = week({
      [WEDNESDAY]: [quest(2, { scheduledDate: WEDNESDAY })],
    });
    const incoming = questlogEntry(
      { ...queued(7, "Neu"), plannedDurationMinutes: 20 },
      WEDNESDAY,
    );
    const result = dropOnDay(
      plan,
      { todoId: 7, toDate: WEDNESDAY, index: 1 },
      incoming,
    )!;
    expect(result.write).toEqual({
      todoId: 7,
      moveTo: WEDNESDAY,
      confirmFixed: false,
      order: [
        { type: "todo", id: 2 },
        { type: "todo", id: 7 },
      ],
    });
    const day = result.plan.days.find((item) => item.date === WEDNESDAY)!;
    expect(day.entries.map((entry) => entry.title)).toEqual(["Quest 2", "Neu"]);
    // Never into the past, not even from the Questlog.
    expect(
      dropOnDay(plan, { todoId: 7, toDate: MONDAY, index: 0 }, incoming),
    ).toBeNull();
  });
});

describe("stepDrop", () => {
  const plan = week({
    [MONDAY]: [],
    [TODAY]: [quest(1, { timeOfDay: "09:00" }), quest(2), daily(null), quest(3)],
  });

  it("steps over rows that are not part of the order", () => {
    const drop = stepDrop(plan, 3, "up")!;
    expect(dropOnDay(plan, drop)!.write.order).toEqual([
      { type: "todo", id: 1 },
      { type: "todo", id: 3 },
      { type: "todo", id: 2 },
    ]);
    expect(stepDrop(plan, 3, "down")).toBeNull();
  });

  it("leaves an appointment where its time puts it, but steps past it", () => {
    expect(stepDrop(plan, 1, "down")).toMatchObject({ index: 1 });
    const drop = stepDrop(plan, 2, "up")!;
    expect(dropOnDay(plan, drop)!.write.order).toEqual([
      { type: "todo", id: 2 },
      { type: "todo", id: 1 },
      { type: "todo", id: 3 },
    ]);
  });

  it("goes to the end of the next day with an arrow key, but never into the past", () => {
    expect(stepDrop(plan, 2, "right")).toEqual({
      todoId: 2,
      toDate: WEDNESDAY,
      index: 0,
    });
    expect(stepDrop(plan, 2, "left")).toBeNull();
    // An appointment changes its day too; dropOnDay confirms its time.
    expect(stepDrop(plan, 1, "right")?.toDate).toBe(WEDNESDAY);
  });
});

describe("dropRunOnDay and stepRunDrop", () => {
  const run = (overrides: Partial<WeekPlanHabitEntry> = {}) =>
    daily(9, { moveUntil: WEDNESDAY, ...overrides });

  it("sorts a run within its day", () => {
    const result = dropRunOnDay(week({ [TODAY]: [quest(1), run()] }), {
      occurrenceId: 9,
      toDate: TODAY,
      index: 0,
    })!;
    expect(titles(result.plan, TODAY)).toEqual(["Laufen", "Quest 1"]);
    expect(result.write).toEqual({
      occurrenceId: 9,
      moveTo: null,
      order: [
        { type: "habit", id: 9 },
        { type: "todo", id: 1 },
      ],
    });
  });

  it("moves a run within its window only, a run left behind too", () => {
    const plan = week({ [TODAY]: [run()] });
    expect(
      dropRunOnDay(plan, { occurrenceId: 9, toDate: WEDNESDAY, index: 0 })!
        .write,
    ).toEqual({
      occurrenceId: 9,
      moveTo: WEDNESDAY,
      order: [{ type: "habit", id: 9 }],
    });
    expect(
      dropRunOnDay(plan, { occurrenceId: 9, toDate: "2026-11-19", index: 0 }),
    ).toBeNull();
    expect(
      dropRunOnDay(week({ [TODAY]: [run({ moveUntil: null })] }), {
        occurrenceId: 9,
        toDate: WEDNESDAY,
        index: 0,
      }),
    ).toBeNull();
    const left = dropRunOnDay(week({}, [run({ isOverdue: true })]), {
      occurrenceId: 9,
      toDate: TODAY,
      index: 0,
    })!;
    expect(left.plan.overdue).toEqual([]);
    expect(left.write.moveTo).toBe(TODAY);
  });

  it("steps a run up and down, and left or right within its window", () => {
    const plan = week({ [TODAY]: [quest(1), run()] });
    expect(stepRunDrop(plan, 9, "up")).toEqual({
      occurrenceId: 9,
      toDate: TODAY,
      index: 0,
    });
    expect(stepRunDrop(plan, 9, "down")).toBeNull();
    expect(stepRunDrop(plan, 9, "right")).toEqual({
      occurrenceId: 9,
      toDate: WEDNESDAY,
      index: 0,
    });
    expect(stepRunDrop(plan, 9, "left")).toBeNull();
    expect(
      stepRunDrop(week({ [WEDNESDAY]: [run()] }), 9, "right"),
    ).toBeNull();
  });
});

describe("shelveQuest", () => {
  it("sorts the Questlog column and says its whole new order", () => {
    const plan = week({});
    const backlog = [queued(1), queued(2), queued(3)];
    const result = shelveQuest(plan, backlog, { todoId: 3, index: 0 })!;
    expect(result.backlog.map(({ id }) => id)).toEqual([3, 1, 2]);
    expect(result.write).toEqual({ todoId: 3, unplan: false, order: [3, 1, 2] });
    expect(result.plan).toBe(plan);
    expect(shelveQuest(plan, backlog, { todoId: 2, index: 1 })).toBeNull();
  });

  it("takes a quest off its day, or off what was left behind, and puts it where it was dropped", () => {
    const plan = week({ [WEDNESDAY]: [quest(5, { scheduledDate: WEDNESDAY })] }, [
      quest(6, { isOverdue: true, scheduledDate: MONDAY }),
    ]);
    const fromDay = shelveQuest(plan, [queued(1), queued(2)], {
      todoId: 5,
      index: 1,
    })!;
    expect(fromDay.write).toEqual({ todoId: 5, unplan: true, order: [1, 5, 2] });
    expect(fromDay.backlog[1]).toMatchObject({ id: 5, title: "Quest 5" });
    expect(titles(fromDay.plan, WEDNESDAY)).toEqual([]);

    const fromOverdue = shelveQuest(plan, [], { todoId: 6, index: 4 })!;
    expect(fromOverdue.write.order).toEqual([6]);
    expect(fromOverdue.plan.overdue).toEqual([]);
  });

  it("ignores dailies and done quests", () => {
    const plan = week({
      [TODAY]: [daily(8), quest(9, { status: "completed" })],
    });
    expect(shelveQuest(plan, [], { todoId: 8, index: 0 })).toBeNull();
    expect(shelveQuest(plan, [], { todoId: 9, index: 0 })).toBeNull();
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

describe("openSummary", () => {
  it("counts what is open and adds up its planned time", () => {
    expect(
      openSummary({
        date: TODAY,
        entries: [
          quest(1, { plannedDurationMinutes: 60 }),
          daily(2, { plannedDurationMinutes: 30 }),
          quest(3),
          quest(4, { status: "completed", plannedDurationMinutes: 90 }),
        ],
      }),
    ).toBe("3 offen · 1 Std. 30 Min.");
  });

  it("stays empty for a day without anything open", () => {
    expect(openSummary({ date: TODAY, entries: [] })).toBe("");
  });
});

describe("questlogStartsOpen", () => {
  it("follows a choice made on this device", () => {
    expect(questlogStartsOpen("open", false)).toBe(true);
    expect(questlogStartsOpen("closed", true)).toBe(false);
  });

  it("opens by itself only where seven days still fit beside it", () => {
    expect(questlogStartsOpen(null, true)).toBe(true);
    expect(questlogStartsOpen(null, false)).toBe(false);
    expect(questlogStartsOpen("something else", false)).toBe(false);
  });
});

describe("fittingDays", () => {
  it("fills the width with readable day columns beside the Questlog", () => {
    // 78rem: the open column (12rem) leaves 66rem, four days of 14rem plus gaps.
    expect(fittingDays(78, { questlogOpen: true, overdue: false, least: 2 })).toBe(4);
    // The rail leaves room for a fifth.
    expect(fittingDays(78, { questlogOpen: false, overdue: false, least: 2 })).toBe(5);
    // What was left behind takes a column of its own.
    expect(fittingDays(78, { questlogOpen: true, overdue: true, least: 2 })).toBe(3);
  });

  it("counts a column that just fits", () => {
    // Rail 2.75 + 3 x (0.5 + 14) = 46.25rem.
    expect(fittingDays(46.25, { questlogOpen: false, overdue: false, least: 1 })).toBe(3);
    expect(fittingDays(46.2, { questlogOpen: false, overdue: false, least: 1 })).toBe(2);
  });

  it("keeps today, and from a desktop two days, where nothing fits", () => {
    // A phone: rail and today.
    expect(fittingDays(23.75, { questlogOpen: false, overdue: false, least: 1 })).toBe(1);
    expect(fittingDays(20, { questlogOpen: true, overdue: true, least: 1 })).toBe(1);
    expect(fittingDays(30, { questlogOpen: true, overdue: true, least: 2 })).toBe(2);
  });
});

describe("boardColumns", () => {
  it("lays out the Questlog, what was left behind and the days", () => {
    expect(boardColumns({ questlogOpen: true, overdue: true, days: 3 })).toBe(
      "12rem minmax(14rem, 1fr) repeat(3, minmax(14rem, 1fr))",
    );
    expect(boardColumns({ questlogOpen: false, overdue: false, days: 1 })).toBe(
      "2.75rem repeat(1, minmax(14rem, 1fr))",
    );
  });
});

describe("todayScroll", () => {
  it("stays at the start while today is fully in view", () => {
    expect(todayScroll({ start: 52, end: 276 }, { width: 380, sticky: 52 })).toBe(0);
  });

  it("brings today right beside the Questlog column, which stays in place", () => {
    // Rail (44 + 8), then what was left behind (224 + 8), then today.
    expect(todayScroll({ start: 284, end: 508 }, { width: 380, sticky: 52 })).toBe(
      232,
    );
  });
});

describe("the phone's board: chips, start column and the column in view", () => {
  const today = "2026-11-24";
  const days = ["2026-11-24", "2026-11-25", "2026-11-26"];

  it("names every column in the board's order, today as Heute, the rest by weekday", () => {
    expect(planChips({ overdue: true, days, today })).toEqual([
      { key: "questlog", label: "Questlog", name: "Questlog" },
      { key: "overdue", label: "Liegen geblieben", name: "Liegen geblieben" },
      { key: "2026-11-24", label: "Heute", name: "Heute, Dienstag, 24. Nov." },
      { key: "2026-11-25", label: "Mi", name: "Mittwoch, 25. Nov." },
      { key: "2026-11-26", label: "Do", name: "Donnerstag, 26. Nov." },
    ]);
    expect(
      planChips({ overdue: false, days, today }).map((chip) => chip.label),
    ).toEqual(["Questlog", "Heute", "Mi", "Do"]);
  });

  it("opens on today, or on the first day when the board starts later", () => {
    expect(startColumn(planChips({ overdue: true, days, today }), today)).toBe(2);
    expect(startColumn(planChips({ overdue: false, days, today }), today)).toBe(1);
    const later = planChips({ overdue: false, days: days.slice(1), today });
    expect(later[1]!.label).toBe("Mi");
    expect(startColumn(later, today)).toBe(1);
    expect(startColumn([], today)).toBe(0);
  });

  it("counts the nearest column as the one in view, within the board", () => {
    expect(columnAt(0, 340, 5)).toBe(0);
    expect(columnAt(169, 340, 5)).toBe(0);
    expect(columnAt(171, 340, 5)).toBe(1);
    expect(columnAt(680, 340, 5)).toBe(2);
    expect(columnAt(99_999, 340, 5)).toBe(4);
    expect(columnAt(-20, 340, 5)).toBe(0);
    expect(columnAt(100, 0, 5)).toBe(0);
  });
});

describe("a Google event on the Plan", () => {
  const event = (
    eventId: number,
    timeOfDay: string,
  ): WeekPlanEventEntry => ({
    ...WEEK_ENTRY_FIELDS,
    type: "event",
    eventId,
    status: "pending",
    start: `${WEDNESDAY}T10:00:00Z`,
    end: `${WEDNESDAY}T11:00:00Z`,
    title: `Termin ${eventId}`,
    timeOfDay,
  });
  const titles = (plan: WeekPlanResponse, date: string) =>
    plan.days.find((day) => day.date === date)!.entries.map(({ title }) => title);

  it("drags among the cards without a time and writes its place", () => {
    const plan = week({
      [WEDNESDAY]: [event(9, "11:00"), quest(1, { scheduledDate: WEDNESDAY }), quest(2, { scheduledDate: WEDNESDAY })],
    });
    const result = dropEventOnDay(plan, { eventId: 9, toDate: WEDNESDAY, index: 2 })!;
    expect(titles(result.plan, WEDNESDAY)).toEqual(["Quest 1", "Quest 2", "Termin 9"]);
    expect(result.order).toEqual([
      { type: "todo", id: 1 },
      { type: "todo", id: 2 },
      { type: "event", id: 9 },
    ]);
  });

  it("never passes an appointment and stays on its own day", () => {
    const plan = week({
      [WEDNESDAY]: [
        event(9, "11:00"),
        quest(1, { scheduledDate: WEDNESDAY }),
        quest(3, { scheduledDate: WEDNESDAY, timeOfDay: "13:00" }),
      ],
    });
    const past = dropEventOnDay(plan, { eventId: 9, toDate: WEDNESDAY, index: 2 })!;
    expect(titles(past.plan, WEDNESDAY)).toEqual(["Quest 1", "Termin 9", "Quest 3"]);
    expect(dropEventOnDay(plan, { eventId: 9, toDate: TODAY, index: 0 })).toBeNull();
  });

  it("is not counted as open work", () => {
    expect(openSummary({ date: WEDNESDAY, entries: [event(9, "11:00")] })).toBe("");
  });
});
