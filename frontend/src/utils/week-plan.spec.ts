import { describe, expect, it } from "vitest";
import { WEEK_ENTRY_FIELDS, WEEK_HABIT_FIELDS } from "../types/fixtures";
import type {
  WeekPlanDay,
  WeekPlanEntry,
  WeekPlanEventEntry,
  WeekPlanHabitEntry,
  WeekPlanResponse,
  WeekPlanTodoEntry,
} from "../types/week-plan";
import {
  arrangeOpen,
  boardColumns,
  dayOrder,
  doneEntries,
  isForecast,
  openEntries,
  withEventDone,
  entryKey,
  firstDayFromQuery,
  fittingDays,
  openSummary,
  planQuery,
  planQueryFromWeek,
  questlogStartsOpen,
  shiftedStart,
  todayScroll,
  weekOpenMinute,
  planChips,
  startColumn,
  columnAt,
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
  it("names what the day's order holds: appointments, stored runs and forecasts with their day", () => {
    expect(
      dayOrder(
        [quest(2, { timeOfDay: "09:00" }), quest(3), daily(7), daily(null)],
        "2026-11-27",
      ),
    ).toEqual([
      { type: "todo", id: 2 },
      { type: "todo", id: 3 },
      { type: "habit", id: 7 },
      { type: "forecast", id: 5, date: "2026-11-27" },
    ]);
  });
});

describe("arrangeOpen", () => {
  it("keeps the server's order and holds appointments on the clock, forecasts among them", () => {
    const early = daily(null, { timeOfDay: "09:00" });
    const late = daily(null, { timeOfDay: "16:00" });
    const noon = quest(2, { timeOfDay: "12:00" });
    const first = quest(1);
    const last = quest(3);
    // The server's order: as sent, it stays.
    expect(arrangeOpen([early, first, noon, late, last])).toEqual([
      early,
      first,
      noon,
      late,
      last,
    ]);
    // A forecast without a time sorted between two quests stays there.
    const read = daily(null, { title: "Lesen" });
    expect(arrangeOpen([first, read, last])).toEqual([first, read, last]);
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

describe("weekOpenMinute", () => {
  it("opens on a full hour: before now, before the first entry, or at 8:00", () => {
    expect(weekOpenMinute(18 * 60 + 45, 7 * 60)).toBe(17 * 60);
    expect(weekOpenMinute(18 * 60 + 29, null)).toBe(16 * 60);
    expect(weekOpenMinute(null, 9 * 60 + 15)).toBe(8 * 60);
    expect(weekOpenMinute(null, null)).toBe(8 * 60);
    expect(weekOpenMinute(30, null)).toBe(0);
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

  it("leads with today when asked, even if it would fit further on", () => {
    // The Kalender week: hours (48), Monday (120), then today.
    expect(
      todayScroll({ start: 168, end: 288 }, { width: 375, sticky: 48, lead: true }),
    ).toBe(120);
    expect(
      todayScroll({ start: 48, end: 168 }, { width: 375, sticky: 48, lead: true }),
    ).toBe(0);
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

describe("isForecast", () => {
  it("is a run the schedule only forecasts: open and not stored", () => {
    const run = (occurrenceId: number | null, status: "pending" | "completed" = "pending") =>
      ({ ...WEEK_ENTRY_FIELDS, ...WEEK_HABIT_FIELDS, type: "habit", occurrenceId, status }) as WeekPlanEntry;
    expect(isForecast(run(null))).toBe(true);
    expect(isForecast(run(92))).toBe(false);
    expect(isForecast(run(null, "completed"))).toBe(false);
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

  it("ticked off, it stands among the day's done entries, and opens again", () => {
    const plan = week({
      [WEDNESDAY]: [event(9, "11:00"), quest(1, { scheduledDate: WEDNESDAY })],
    });
    const day = (shown: WeekPlanResponse) =>
      shown.days.find((entry) => entry.date === WEDNESDAY)!;
    const ticked = withEventDone(plan, 9, true);
    expect(openEntries(day(ticked)).map(({ title }) => title)).toEqual(["Quest 1"]);
    expect(doneEntries(day(ticked)).map(({ title }) => title)).toEqual(["Termin 9"]);
    const opened = withEventDone(ticked, 9, false);
    expect(doneEntries(day(opened))).toEqual([]);
    // Another event keeps its state.
    expect(withEventDone(plan, 4, true)).toEqual(plan);
  });

  it("is not counted as open work", () => {
    expect(openSummary({ date: WEDNESDAY, entries: [event(9, "11:00")] })).toBe("");
  });
});
