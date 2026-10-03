import { describe, expect, it } from "vitest";
import { formatHabitSchedule } from "./habit";
describe("formatHabitSchedule", () => {
  it("describes a daily interval", () => {
    expect(
      formatHabitSchedule({
        type: "interval",
        intervalDays: 1,
        missedOccurrencePolicy: "skip",
      }),
    ).toBe("Täglich");
  });
  it("describes a longer interval", () => {
    expect(
      formatHabitSchedule({
        type: "interval",
        intervalDays: 3,
        missedOccurrencePolicy: "carry_over",
      }),
    ).toBe("Alle 3 Tage");
  });
  it("describes weekdays in Monday-first order", () => {
    expect(
      formatHabitSchedule({
        type: "fixed_weekdays",
        weekdays: ["sunday", "monday", "thursday"],
        missedOccurrencePolicy: "skip",
      }),
    ).toBe("Montag, Donnerstag, Sonntag");
  });
  it("describes a weekly target", () => {
    expect(
      formatHabitSchedule({ type: "weekly_target", weeklyTarget: 4 }),
    ).toBe("4 Mal pro Woche");
  });
});
