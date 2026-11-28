import { describe, expect, it } from "vitest";
import type { WeekPlanEntry } from "../types/week-plan";
import { asPlannerItem, relationLabel, tallyOfEntries } from "./other-day";

const context = {
  title: "Steuer",
  timeOfDay: null,
  plannedDurationMinutes: 30,
  campaign: null,
  isOverdue: false,
};
const quest: WeekPlanEntry = {
  ...context,
  type: "todo",
  todoId: 7,
  status: "pending",
  scheduledDate: "2026-11-26",
};
const forecast: WeekPlanEntry = {
  ...context,
  title: "Laufen",
  type: "habit",
  habitId: 3,
  occurrenceId: null,
  status: "pending",
  moveUntil: null,
  timerEligible: false,
  streak: { current: 2, best: 5, unit: "runs" },
};

describe("relationLabel", () => {
  it("names the days next to today in words, the rest by distance", () => {
    expect(relationLabel("2026-11-25", "2026-11-25")).toBeNull();
    expect(relationLabel("2026-11-24", "2026-11-25")).toBe("Gestern");
    expect(relationLabel("2026-11-26", "2026-11-25")).toBe("Morgen");
    expect(relationLabel("2026-11-23", "2026-11-25")).toBe("Vorgestern");
    expect(relationLabel("2026-11-27", "2026-11-25")).toBe("Übermorgen");
    expect(relationLabel("2026-11-30", "2026-11-25")).toBe("in 5 Tagen");
    expect(relationLabel("2026-11-20", "2026-11-25")).toBe("vor 5 Tagen");
  });

  it("counts across a change of the clocks", () => {
    expect(relationLabel("2027-03-29", "2027-03-27")).toBe("Übermorgen");
  });
});

describe("tallyOfEntries", () => {
  it("counts done, open and skipped entries", () => {
    expect(
      tallyOfEntries([
        quest,
        { ...quest, todoId: 8, status: "completed" },
        { ...forecast, status: "skipped" },
      ]),
    ).toEqual({ completed: 1, open: 1, carriedOver: 0, skipped: 1 });
  });
});

describe("asPlannerItem", () => {
  it("shows a quest on Heute's card, measurable while open like everywhere", () => {
    expect(asPlannerItem(quest, "2026-11-26")).toMatchObject({
      type: "todo",
      todoId: 7,
      title: "Steuer",
      plannedDurationMinutes: 30,
      timerEligible: true,
      workedMinutes: 0,
    });
    expect(
      asPlannerItem({ ...quest, status: "completed" }, "2026-11-26"),
    ).toMatchObject({ timerEligible: false });
  });

  it("gives a forecast run its day and nothing to measure", () => {
    expect(asPlannerItem(forecast, "2026-11-26")).toMatchObject({
      type: "habit",
      habitId: 3,
      occurrenceId: 0,
      scheduledDate: "2026-11-26",
      timerEligible: false,
      streak: { current: 2, best: 5, unit: "runs" },
    });
  });
});
