import { describe, expect, it } from "vitest";
import {
  cardVisible,
  countLine,
  counterLabel,
  counterText,
  dayFromQuery,
  daysInMonth,
  daysSoFar,
  minutesOfTime,
  monthFromQuery,
  monthGroups,
  monthRange,
  nextCardChange,
  nextMonths,
  normalizeLine,
  shortWeekday,
  yearAgo,
  yearsOf,
} from "./day-best";

describe("Das Beste des Tages: the card in Heute", () => {
  it("shows from the card time to the end of the day, never before", () => {
    expect(cardVisible(19 * 60 + 59, "20:00")).toBe(false);
    expect(cardVisible(20 * 60, "20:00")).toBe(true);
    expect(cardVisible(23 * 60 + 59, "20:00")).toBe(true);
    expect(cardVisible(0, "00:00")).toBe(true);
    expect(cardVisible(6 * 60, "21:30")).toBe(false);
  });

  it("wakes the clock exactly when the card is due, then not again", () => {
    expect(nextCardChange(8 * 60, "20:00")).toBe(1200);
    expect(nextCardChange(20 * 60, "20:00")).toBeNull();
  });

  it("reads card times, falling back to 20:00", () => {
    expect(minutesOfTime("21:30")).toBe(1290);
    expect(minutesOfTime("00:00")).toBe(0);
    expect(minutesOfTime("24:00")).toBe(1200);
    expect(minutesOfTime("")).toBe(1200);
  });
});

describe("Das Beste des Tages: the line and its counter", () => {
  it("is one line, as the server stores it", () => {
    expect(normalizeLine("  Sonne \n am See ")).toBe("Sonne am See");
  });

  it("counts only near the limit", () => {
    expect(counterText(0)).toBeNull();
    expect(counterText(239)).toBeNull();
    expect(counterText(240)).toBe("240 / 280");
    expect(counterText(280)).toBe("280 / 280");
    expect(counterLabel(245)).toBe("Noch 35 von 280 Zeichen frei.");
    expect(counterLabel(280)).toBe("Noch 0 von 280 Zeichen frei.");
  });
});

describe("Das Beste des Tages: the timeline", () => {
  it("groups lines by month, newest month and day first", () => {
    const groups = monthGroups([
      { date: "2026-10-03", text: "C" },
      { date: "2026-11-18", text: "A" },
      { date: "2026-11-02", text: "B" },
      { date: "2025-12-31", text: "D" },
    ]);
    expect(
      groups.map(({ month, label, entries }) => [
        month,
        label,
        entries.map((entry) => entry.text).join(""),
      ]),
    ).toEqual([
      ["2026-11", "November 2026", "AB"],
      ["2026-10", "Oktober 2026", "C"],
      ["2025-12", "Dezember 2025", "D"],
    ]);
  });

  it("says how many of the month's days have a line, honest in the running month", () => {
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysSoFar("2026-11", "2026-11-23")).toBe(23);
    expect(daysSoFar("2026-10", "2026-11-23")).toBe(31);
    expect(countLine(12, 30)).toBe("12 von 30 Tagen");
    expect(countLine(1, 1)).toBe("1 von 1 Tag");
    expect(monthRange("2026-02")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("pages through the months with lines, from the anchor down", () => {
    const months = ["2026-11", "2026-09", "2026-08", "2025-01", "2024-06"];
    expect(nextMonths(months, "2026-11", [])).toEqual([
      "2026-11",
      "2026-09",
      "2026-08",
    ]);
    expect(
      nextMonths(months, "2026-11", ["2026-11", "2026-09", "2026-08"]),
    ).toEqual(["2025-01", "2024-06"]);
    expect(nextMonths(months, "2026-10", [])).toEqual([
      "2026-09",
      "2026-08",
      "2025-01",
    ]);
    expect(nextMonths(months, "2024-06", ["2024-06"])).toEqual([]);
  });

  it("finds the same day a year ago, but none for 29 February", () => {
    expect(yearAgo("2026-11-23")).toBe("2025-11-23");
    expect(yearAgo("2028-02-29")).toBeNull();
  });

  it("takes only real, past months and days from the address", () => {
    expect(monthFromQuery("2026-03", "2026-11-23")).toBe("2026-03");
    expect(monthFromQuery("2026-12", "2026-11-23")).toBeNull();
    expect(monthFromQuery("2026-13", "2026-11-23")).toBeNull();
    expect(monthFromQuery(["2026-03"], "2026-11-23")).toBeNull();
    expect(dayFromQuery("2026-11-18", "2026-11-23")).toBe("2026-11-18");
    expect(dayFromQuery("2026-11-24", "2026-11-23")).toBeNull();
    expect(dayFromQuery("2026-02-30", "2026-11-23")).toBeNull();
  });

  it("names rows and the years of the jump", () => {
    expect(shortWeekday("2026-11-18")).toBe("Mi");
    expect(yearsOf(["2026-11", "2026-01", "2024-03"])).toEqual([
      "2026",
      "2024",
    ]);
  });
});
