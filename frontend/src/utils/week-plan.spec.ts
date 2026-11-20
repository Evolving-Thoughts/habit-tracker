import { describe, expect, it } from "vitest";
import { WEEK_ENTRY_FIELDS } from "../types/fixtures";
import type {
  WeekPlanDay,
  WeekPlanHabitEntry,
  WeekPlanResponse,
  WeekPlanTodoEntry,
} from "../types/week-plan";
import {
  arrangeOpen,
  boardScroll,
  dayOrder,
  dropOnDay,
  entryKey,
  offersWayBack,
  openSummary,
  questlogEntry,
  questlogStartsOpen,
  stepDrop,
  weekFromQuery,
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
  type: "habit",
  habitId: 5,
  occurrenceId,
  title: "Laufen",
  status: "pending",
  ...overrides,
});

function week(days: Record<string, WeekPlanDay["entries"]>): WeekPlanResponse {
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
  };
}

const titles = (plan: WeekPlanResponse, date: string) =>
  plan.days.find((day) => day.date === date)!.entries.map(({ title }) => title);

describe("weekFromQuery", () => {
  it("takes the Monday of the week in the address", () => {
    expect(weekFromQuery("2026-11-19", TODAY)).toBe(MONDAY);
  });

  it("falls back to the current week for anything else", () => {
    expect(weekFromQuery("2026-02-30", TODAY)).toBe(MONDAY);
    expect(weekFromQuery(["2026-11-23"], TODAY)).toBe(MONDAY);
    expect(weekFromQuery(undefined, TODAY)).toBe(MONDAY);
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
  it("names what the day's stored order holds: no times, no carried, no forecast", () => {
    expect(
      dayOrder([
        quest(1, { isOverdue: true, scheduledDate: MONDAY }),
        quest(2, { timeOfDay: "09:00" }),
        quest(3),
        daily(7),
        daily(null),
      ]),
    ).toEqual([
      { type: "todo", id: 3 },
      { type: "habit", id: 7 },
    ]);
  });
});

describe("arrangeOpen", () => {
  it("sorts like the server: carried, the clock, the order, then forecasts", () => {
    expect(
      arrangeOpen([
        daily(null, { title: "Vorhersage" }),
        quest(1),
        quest(2, { timeOfDay: "14:00" }),
        quest(3, { isOverdue: true }),
        quest(4, { timeOfDay: "08:00" }),
        quest(5),
      ]).map(({ title }) => title),
    ).toEqual(["Quest 3", "Quest 4", "Quest 2", "Quest 1", "Quest 5", "Vorhersage"]);
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

  it("keeps an appointment on its time and only moves its day", () => {
    const plan = week({
      [TODAY]: [quest(1, { timeOfDay: "10:00" })],
      [WEDNESDAY]: [quest(2, { scheduledDate: WEDNESDAY })],
    });
    const result = dropOnDay(plan, { todoId: 1, toDate: WEDNESDAY, index: 1 })!;

    expect(titles(result.plan, WEDNESDAY)).toEqual(["Quest 1", "Quest 2"]);
    expect(result.write).toEqual({
      todoId: 1,
      moveTo: WEDNESDAY,
      confirmFixed: true,
      order: null,
    });
    expect(
      dropOnDay(plan, { todoId: 1, toDate: TODAY, index: 0 }),
    ).toBeNull();
  });

  it("plans an overdue quest for today when it is dropped there", () => {
    const plan = week({
      [TODAY]: [quest(1, { isOverdue: true, scheduledDate: MONDAY }), quest(2)],
    });
    const result = dropOnDay(plan, { todoId: 1, toDate: TODAY, index: 1 })!;
    expect(result.write).toMatchObject({
      moveTo: TODAY,
      order: [
        { type: "todo", id: 2 },
        { type: "todo", id: 1 },
      ],
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
      { id: 7, title: "Neu", plannedDurationMinutes: 20, campaign: null },
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
      { type: "todo", id: 3 },
      { type: "todo", id: 2 },
    ]);
    expect(stepDrop(plan, 2, "up")).toBeNull();
    expect(stepDrop(plan, 3, "down")).toBeNull();
  });

  it("leaves an appointment where its time puts it", () => {
    expect(stepDrop(plan, 1, "down")).toBeNull();
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

describe("offersWayBack", () => {
  it("offers the way back to now only away from the current week", () => {
    expect(offersWayBack(MONDAY, MONDAY)).toBe(false);
    expect(offersWayBack("2026-11-23", MONDAY)).toBe(true);
    expect(offersWayBack("2026-11-09", MONDAY)).toBe(true);
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

describe("boardScroll", () => {
  /** Seven columns of `width` with 8px between them, from `offset`. */
  const columns = (width: number, offset = 0) =>
    Array.from({ length: 7 }, (_, index) => {
      const start = offset + index * (width + 8);
      return { start, end: start + width };
    });

  it("stays at Monday when the whole week fits", () => {
    expect(boardScroll(columns(140), 6, { width: 1028, padding: 0 })).toBe(0);
  });

  it("stays at Monday while today is in view from there", () => {
    // 900px show Monday to Thursday whole.
    expect(boardScroll(columns(140), 3, { width: 900, padding: 0 })).toBe(0);
  });

  it("scrolls as little as needed for today, onto a column's start", () => {
    // Sunday ends at 1028; 900px from Tuesday's start (148) end at 1048.
    expect(boardScroll(columns(140), 6, { width: 900, padding: 0 })).toBe(148);
    // Friday ends at 732; from Monday it ends at 700: one column on.
    expect(boardScroll(columns(140), 4, { width: 700, padding: 0 })).toBe(148);
  });

  it("puts today at the start where only one day fits, minus the gutter", () => {
    // A phone: 85 % columns behind a 16px gutter.
    const phone = columns(291, 16);
    expect(boardScroll(phone, 2, { width: 375, padding: 16 })).toBe(
      phone[2]!.start - 16,
    );
    expect(boardScroll(phone, 0, { width: 375, padding: 16 })).toBe(0);
  });

  it("stays at the start of a week without today", () => {
    expect(boardScroll(columns(140), -1, { width: 500, padding: 0 })).toBe(0);
  });
});
