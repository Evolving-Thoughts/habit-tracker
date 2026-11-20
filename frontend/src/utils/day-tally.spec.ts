import { describe, expect, it } from "vitest";
import {
  HISTORY_ITEM_FIELDS,
  PLANNED_FIELDS,
  PLANNER_HABIT_FIELDS,
  PLANNER_TODO_FIELDS,
} from "../types/fixtures";
import type {
  DayPlannerHabitItem,
  DayPlannerTodoItem,
} from "../types/day-planner";
import type { HistoryItem, HistoryPlannedItem } from "../types/history";
import {
  dayRelation,
  tallyLine,
  tallyOfHistoryDay,
  tallyOfPlanner,
  untimedLine,
  untimedOfHistoryDay,
} from "./day-tally";

const todo = (
  overrides: Partial<DayPlannerTodoItem> = {},
): DayPlannerTodoItem => ({
  ...PLANNER_TODO_FIELDS,
  type: "todo",
  todoId: 1,
  title: "Quest",
  status: "pending",
  scheduledDate: "2026-10-02",
  completedAt: null,
  plannedDurationMinutes: null,
  isOverdue: false,
  timerEligible: true,
  ...overrides,
});
const habit = (
  overrides: Partial<DayPlannerHabitItem> = {},
): DayPlannerHabitItem => ({
  ...PLANNER_HABIT_FIELDS,
  type: "habit",
  occurrenceId: 1,
  habitId: 1,
  title: "Daily",
  status: "pending",
  scheduledDate: "2026-10-02",
  plannedDurationMinutes: null,
  moveUntil: null,
  scheduleType: "interval",
  isOverdue: false,
  timerEligible: true,
  ...overrides,
});
const resolved = (status: "completed" | "skipped"): HistoryItem => ({
  ...HISTORY_ITEM_FIELDS,
  type: status === "completed" ? "todo" : "habit",
  id: 1,
  habitId: null,
  title: "Erledigt",
  status,
  date: "2026-10-02",
  scheduledDate: "2026-10-02",
  resolvedAt: null,
  plannedDurationMinutes: null,
  deleted: false,
});
let key = 0;
const planned = (isOverdue = false): HistoryPlannedItem => ({
  ...PLANNED_FIELDS,
  key: `todo:${(key += 1)}`,
  type: "todo",
  id: 2,
  habitId: null,
  title: "Offen",
  date: "2026-10-02",
  scheduledDate: isOverdue ? "2026-09-30" : "2026-10-02",
  isOverdue,
  plannedDurationMinutes: null,
});

describe("the day's tally, the same in every view", () => {
  it("counts Heute: done, open for today, from earlier and skipped apart", () => {
    const tally = tallyOfPlanner([
      todo({ status: "completed" }),
      todo({ todoId: 2 }),
      habit({ timeOfDay: "18:00" }),
      todo({ todoId: 3, isOverdue: true, scheduledDate: "2026-09-30" }),
      habit({ occurrenceId: 2, status: "skipped" }),
      habit({ occurrenceId: 3, status: "cancelled" }),
    ]);
    expect(tally).toEqual({
      completed: 1,
      open: 2,
      carriedOver: 1,
      skipped: 1,
    });
    expect(tallyLine(tally, "today")).toBe(
      "1 von 3 erledigt · 1 von früher · 1 übersprungen",
    );
  });

  it("counts a Kalender day from the same parts", () => {
    const tally = tallyOfHistoryDay({
      items: [resolved("completed"), resolved("skipped")],
      planned: [planned(), planned(), planned(true)],
    });
    expect(tally).toEqual({
      completed: 1,
      open: 2,
      carriedOver: 1,
      skipped: 1,
    });
    // Heute and the Kalender say the same about the same day.
    expect(tallyLine(tally, "today")).toBe(
      "1 von 3 erledigt · 1 von früher · 1 übersprungen",
    );
  });

  it("names on past days what was done and on coming days what is planned", () => {
    const tally = { completed: 4, open: 0, carriedOver: 0, skipped: 1 };
    expect(tallyLine(tally, "past")).toBe("4 erledigt · 1 übersprungen");
    expect(
      tallyLine({ completed: 0, open: 3, carriedOver: 0, skipped: 0 }, "future"),
    ).toBe("3 geplant");
  });

  it("says nothing about an empty day, and only what waits when today is free", () => {
    const empty = { completed: 0, open: 0, carriedOver: 0, skipped: 0 };
    expect(tallyLine(empty, "today")).toBeNull();
    expect(tallyLine({ ...empty, carriedOver: 2 }, "today")).toBe(
      "2 von früher",
    );
    expect(tallyLine({ ...empty, completed: 7, open: 0 }, "today")).toBe(
      "7 von 7 erledigt",
    );
  });

  it("places a day relative to today", () => {
    expect(dayRelation("2026-10-01", "2026-10-02")).toBe("past");
    expect(dayRelation("2026-10-02", "2026-10-02")).toBe("today");
    expect(dayRelation("2026-10-03", "2026-10-02")).toBe("future");
  });
});

describe("what a day holds without a time, for the week's heads", () => {
  it("counts done and open quests and Daily runs without a time", () => {
    const day = {
      items: [
        resolved("completed"),
        resolved("skipped"),
        { ...resolved("completed"), type: "habit" as const, id: 3 },
        { ...resolved("completed"), id: 4, timeOfDay: "09:00" },
      ],
      planned: [
        planned(),
        planned(true),
        { ...planned(), type: "habit" as const },
        { ...planned(), timeOfDay: "14:00" },
      ],
    };
    const tally = untimedOfHistoryDay(day);
    // Skipped runs and appointments are not counted; earlier work is apart.
    expect(tally).toEqual({ quests: 2, dailies: 2, carriedOver: 1 });
    expect(untimedLine(tally)).toBe("2 Quests · 2 Dailies · 1 von früher");
  });

  it("names one of each in the singular and an empty day not at all", () => {
    expect(untimedLine({ quests: 1, dailies: 1, carriedOver: 0 })).toBe(
      "1 Quest · 1 Daily",
    );
    expect(untimedLine({ quests: 0, dailies: 0, carriedOver: 0 })).toBeNull();
  });
});
