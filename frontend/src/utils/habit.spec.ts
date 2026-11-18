import { describe, expect, it } from "vitest";
import type { HistoryResponse } from "../types/history";
import { dailyWeekStatus, formatHabitSchedule } from "./habit";
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
describe("dailyWeekStatus", () => {
  // Wednesday, 18 November 2026.
  const today = "2026-11-18";
  const habit = {
    id: 7,
    isActive: true,
    currentSchedule: {
      id: 1,
      effectiveFrom: "2026-11-01",
      effectiveAt: "2026-11-01T08:00:00Z",
      endsAt: null,
      cancelledAt: null,
      firstDueDate: "2026-11-02",
      schedule: {
        type: "fixed_weekdays" as const,
        weekdays: ["monday" as const, "friday" as const],
        missedOccurrencePolicy: "skip" as const,
      },
    },
  };
  const week = (
    days: Record<string, { items?: unknown[]; planned?: unknown[] }>,
  ): HistoryResponse =>
    ({
      today,
      timeZone: "Europe/Berlin",
      startDate: "2026-11-16",
      endDate: "2026-11-22",
      days: ["16", "17", "18", "19", "20", "21", "22"].map((day) => ({
        date: `2026-11-${day}`,
        items: [],
        planned: [],
        work: { minutes: 0 },
        ...days[`2026-11-${day}`],
      })),
    }) as HistoryResponse;
  const entry = { type: "habit", habitId: 7 };

  it("names the next due weekday of a fixed schedule", () => {
    expect(
      dailyWeekStatus(
        habit,
        week({ "2026-11-20": { planned: [entry] } }),
        today,
      ),
    ).toBe("Freitag fällig");
  });

  it("says a skipped run plainly and stays quiet without the week", () => {
    expect(
      dailyWeekStatus(
        habit,
        week({ [today]: { items: [{ ...entry, status: "skipped" }] } }),
        today,
      ),
    ).toBe("heute übersprungen");
    expect(dailyWeekStatus(habit, null, today)).toBeNull();
    expect(
      dailyWeekStatus({ ...habit, isActive: false }, week({}), today),
    ).toBeNull();
  });
});
