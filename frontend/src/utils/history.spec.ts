import { describe, expect, it } from "vitest";
import {
  addDays,
  weekStart,
  dayCounts,
  dayLabel,
  daySummary,
  longDate,
  monthLabel,
  shortDate,
  supportedHistoryDate,
  weekLabel,
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
  it("displays German date and weekday", () => {
    expect(dayLabel("2026-10-07")).toBe("Mittwoch, 7. Okt.");
    expect(shortDate("2026-03-01")).toBe("1. März");
    expect(longDate("2026-11-12")).toBe("12. November");
    expect(monthLabel("2026-11-12")).toBe("November 2026");
  });
  it("names a week inside one month and across two", () => {
    expect(weekLabel("2026-11-12")).toBe("9.–15. Nov.");
    expect(weekLabel("2026-12-01")).toBe("30. Nov. – 6. Dez.");
  });
  it.each(["", "07.10.2026", "2026-02-30", "0000-01-01", "9999-12-31"])(
    "rejects invalid/unsupported %s",
    (date) => expect(supportedHistoryDate(date, "day")).toBe(false),
  );
  it("rejects overflowing weeks", () =>
    expect(supportedHistoryDate("9999-12-30", "week")).toBe(false));
});

it("counts a day and names only the non-zero counts", () => {
  const todo = {
    type: "todo" as const,
    id: 1,
    habitId: null,
    title: "Todo",
    categoryName: null,
    why: null,
    status: "completed" as const,
    date: "2026-10-07",
    scheduledDate: null,
    resolvedAt: null,
    plannedDurationMinutes: null,
    deleted: false,
  };
  expect(daySummary(dayCounts({ items: [] }))).toBe("Nichts geplant");
  const counts = dayCounts({
    items: [todo, todo, { ...todo, type: "habit", status: "skipped" }],
    external: [{}],
  });
  expect(counts).toEqual({ completed: 2, skipped: 1, open: 0, events: 1 });
  expect(daySummary(counts)).toBe("2 erledigt · 1 übersprungen · 1 Termin");
});
