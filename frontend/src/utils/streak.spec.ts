import { describe, expect, it } from "vitest";
import { streakLine, streakSummary } from "./streak";

describe("streakLine", () => {
  it("names a running series and nothing else", () => {
    expect(streakLine({ current: 12, best: 21, unit: "runs" })).toBe(
      "12 in Folge",
    );
    expect(streakLine({ current: 0, best: 21, unit: "runs" })).toBeNull();
    expect(streakLine(undefined)).toBeNull();
  });

  it("counts weeks for a weekly goal", () => {
    expect(streakLine({ current: 1, best: 1, unit: "weeks" })).toBe(
      "1 Woche in Folge",
    );
    expect(streakLine({ current: 3, best: 4, unit: "weeks" })).toBe(
      "3 Wochen in Folge",
    );
  });
});

describe("streakSummary", () => {
  it("says the series and the record, a broken one as a plain number", () => {
    expect(streakSummary({ current: 12, best: 21, unit: "runs" })).toBe(
      "12 in Folge · Rekord 21",
    );
    expect(streakSummary({ current: 0, best: 21, unit: "runs" })).toBe(
      "0 in Folge · Rekord 21",
    );
    expect(streakSummary({ current: 2, best: 5, unit: "weeks" })).toBe(
      "2 Wochen in Folge · Rekord 5 Wochen",
    );
  });

  it("says nothing before the first done run", () => {
    expect(streakSummary({ current: 0, best: 0, unit: "runs" })).toBeNull();
  });
});
