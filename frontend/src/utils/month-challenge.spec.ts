import { describe, expect, it } from "vitest";
import type { MonthChallenge } from "../types/month-challenge";
import {
  barShare,
  barText,
  canPrepareNext,
  daysLeftInMonth,
  monthName,
  monthTitle,
  nextMonthKey,
  progressLine,
  resultLabel,
  runLine,
  statusLine,
} from "./month-challenge";

const challenge = (change: Partial<MonthChallenge> = {}): MonthChallenge => ({
  id: 1,
  month: "2026-11",
  startDate: "2026-11-01",
  endDate: "2026-11-30",
  habitId: 3,
  title: "Sport",
  reminderTime: "19:00",
  status: "running",
  endedAt: null,
  day: 12,
  days: 30,
  done: 11,
  missed: 1,
  remaining: 18,
  total: 30,
  percent: 36,
  todayRun: "done",
  todayOccurrenceId: null,
  ...change,
});

describe("month challenge words", () => {
  it("says where a running challenge stands", () => {
    expect(progressLine(challenge())).toBe(
      "Tag 12 · 11 von 12 geschafft · noch 18",
    );
    // Before anything was decided there is nothing to count against.
    expect(
      progressLine(challenge({ day: 1, done: 0, missed: 0, remaining: 19 })),
    ).toBe("Tag 1 · noch 19");
    expect(
      progressLine(challenge({ day: 30, done: 29, missed: 1, remaining: 0 })),
    ).toBe("Tag 30 · 29 von 30 geschafft");
  });

  it("names the challenge in its run's meta line on Heute", () => {
    expect(
      runLine(challenge({ day: 2, done: 0, missed: 0, remaining: 4 })),
    ).toBe("Monats-Challenge · Tag 2 · noch 4");
    expect(runLine(challenge())).toBe(
      "Monats-Challenge · Tag 12 · 11 von 12 geschafft · noch 18",
    );
    expect(
      runLine(challenge({ day: null, done: 0, missed: 0, remaining: 0 })),
    ).toBe("Monats-Challenge");
  });

  it("names the result honestly once closed", () => {
    const done = challenge({
      status: "succeeded",
      day: null,
      done: 30,
      missed: 0,
      remaining: 0,
      percent: 100,
    });
    expect(statusLine(done)).toBe("Geschafft · 30 von 30");
    expect(resultLabel(done)).toBe("Geschafft");
    const short = challenge({
      status: "finished",
      day: null,
      done: 27,
      missed: 3,
      remaining: 0,
      percent: 90,
    });
    expect(statusLine(short)).toBe("90 % geschafft (27 von 30)");
    expect(resultLabel(short)).toBe("90 %");
    expect(
      statusLine(
        challenge({
          status: "ended",
          day: null,
          endedAt: "2026-11-14T19:00:00.000Z",
          done: 1,
          missed: 1,
          remaining: 0,
          total: 2,
        }),
      ),
    ).toBe("Beendet am 14. Nov. · 1 von 2 geschafft");
    expect(
      statusLine(
        challenge({ status: "upcoming", startDate: "2026-12-01", total: 31 }),
      ),
    ).toBe("Ab 1. Dez. · 31 Läufe fällig");
  });

  it("fills the bar by the done share and reads it out", () => {
    expect(barShare(challenge())).toBeCloseTo(36.67, 1);
    expect(barShare(challenge({ total: 0, done: 0 }))).toBe(0);
    expect(barText(challenge())).toBe("11 von 30 Läufen geschafft");
  });

  it("knows its months and when the next one can be set", () => {
    expect(monthName("2026-11")).toBe("November");
    expect(monthTitle("2026-03")).toBe("März 2026");
    expect(nextMonthKey("2026-11")).toBe("2026-12");
    expect(nextMonthKey("2026-12")).toBe("2027-01");
    expect(canPrepareNext("2026-11-15")).toBe(false);
    expect(canPrepareNext("2026-11-16")).toBe(true);
    expect(daysLeftInMonth("2026-11-23")).toBe(8);
    expect(daysLeftInMonth("2028-02-01")).toBe(29);
  });
});
