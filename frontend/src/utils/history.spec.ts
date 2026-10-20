import { describe, expect, it } from "vitest";
import {
  addDays,
  weekStart,
  dayLabel,
  daySummary,
  supportedHistoryDate,
} from "./history";
describe("history calendar", () => {
  it.each(["2026-10-05", "2026-10-07", "2026-10-11"])(
    "starts Monday for %s",
    (date) => expect(weekStart(date)).toBe("2026-10-05"),
  );
  it("crosses year and leap boundaries", () => {
    expect(weekStart("2027-01-01")).toBe("2026-12-28");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });
  it("moves calendar days without DST shifts", () =>
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30"));
  it("displays German date and weekday", () =>
    expect(dayLabel("2026-10-07")).toBe("Mittwoch, 07.10.2026"));
  it.each(["", "07.10.2026", "2026-02-30", "0000-01-01", "9999-12-31"])(
    "rejects invalid/unsupported %s",
    (date) => expect(supportedHistoryDate(date, "day")).toBe(false),
  );
  it("rejects overflowing weeks", () =>
    expect(supportedHistoryDate("9999-12-30", "week")).toBe(false));
});

it("uses German singular and plural in weekly counts", () => {
  const todo = {
    type: "todo" as const,
    id: 1,
    habitId: null,
    title: "Todo",
    status: "completed" as const,
    date: "2026-10-07",
    scheduledDate: null,
    resolvedAt: null,
    plannedDurationMinutes: null,
    deleted: false,
  };
  expect(daySummary([])).toBe(
    "0 Todos erledigt · 0 Habits erledigt · 0 übersprungen",
  );
  expect(daySummary([todo, { ...todo, type: "habit" }])).toBe(
    "1 Todo erledigt · 1 Habit erledigt · 0 übersprungen",
  );
  expect(
    daySummary([todo, todo, { ...todo, type: "habit", status: "skipped" }]),
  ).toBe("2 Todos erledigt · 0 Habits erledigt · 1 übersprungen");
});
