import { describe, expect, it } from "vitest";
import {
  addDays,
  appointmentCount,
  weekStart,
  dayCounts,
  dayLabel,
  fullStop,
  daySummary,
  hasEntries,
  longDate,
  monthLabel,
  rangeContains,
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
    title: "Quest",
    categoryName: null,
    why: null,
    status: "completed" as const,
    date: "2026-10-07",
    scheduledDate: null,
    resolvedAt: null,
    plannedDurationMinutes: null,
    timeOfDay: null,
    deleted: false,
  };
  expect(daySummary(dayCounts({ items: [] }))).toBe("Nichts geplant");
  const counts = dayCounts({
    items: [todo, todo, { ...todo, type: "habit", status: "skipped" }],
    external: [{}],
  });
  expect(counts).toEqual({ completed: 2, skipped: 1, open: 0, events: 1 });
  expect(daySummary(counts)).toBe("2 erledigt · 1 übersprungen · 1 Termin");
  // Measured time stands beside the counts as a bar; only alone it is named.
  expect(daySummary(counts, 130)).toBe(
    "2 erledigt · 1 übersprungen · 1 Termin",
  );
});

it("knows whether the shown range holds a day", () => {
  // Wednesday, 18 November 2026; its week runs from Monday 16 to Sunday 22.
  const today = "2026-11-18";
  expect(rangeContains("day", today, today)).toBe(true);
  expect(rangeContains("day", "2026-11-17", today)).toBe(false);
  expect(rangeContains("week", "2026-11-22", today)).toBe(true);
  expect(rangeContains("week", "2026-11-23", today)).toBe(false);
  expect(rangeContains("month", "2026-11-01", today)).toBe(true);
  expect(rangeContains("month", "2026-12-18", today)).toBe(false);
  expect(rangeContains("day", "", today)).toBe(false);
});

it("says honestly that time was measured on a day without plans", () => {
  const nothing = dayCounts({ items: [] });
  expect(daySummary(nothing, 130)).toBe(
    "Nichts geplant · 2 Std. 10 Min. gemessen",
  );
  expect(daySummary(nothing, 0)).toBe("Nichts geplant");
});

it("counts measured work as something to show on a day", () => {
  const empty = { items: [], work: { minutes: 0, logs: [] } };
  expect(hasEntries(empty)).toBe(false);
  expect(hasEntries({ ...empty, work: { minutes: 25 } })).toBe(true);
  expect(hasEntries({ ...empty, external: [{}] })).toBe(true);
});

describe("fullStop", () => {
  it("ends a sentence once, also after an abbreviated month", () => {
    expect(fullStop("Steht am Mittwoch, 7. Okt.")).toBe(
      "Steht am Mittwoch, 7. Okt.",
    );
    expect(fullStop("Steht am Freitag, 1. Mai")).toBe(
      "Steht am Freitag, 1. Mai.",
    );
  });
});

it("counts the app's own appointments and Google's events for the month's marker", () => {
  const planned = {
    key: "todo-1",
    type: "todo" as const,
    id: 1,
    habitId: null,
    title: "Zahnarzt",
    categoryName: null,
    why: null,
    date: "2026-11-19",
    scheduledDate: "2026-11-19",
    isOverdue: false,
    plannedDurationMinutes: 45,
    timeOfDay: "08:15",
    moveUntil: null,
  };
  expect(appointmentCount({ items: [], planned: [planned] })).toBe(1);
  // A quest without a time is no appointment, nor is a daily with one.
  expect(
    appointmentCount({
      items: [],
      planned: [
        { ...planned, timeOfDay: null },
        { ...planned, type: "habit", habitId: 3 },
      ],
    }),
  ).toBe(0);
  expect(
    appointmentCount({ items: [], planned: [planned], external: [{}, {}] }),
  ).toBe(3);
});
