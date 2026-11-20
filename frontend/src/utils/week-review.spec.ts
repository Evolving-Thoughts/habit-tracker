import { describe, expect, it } from "vitest";
import type { QuestHoursResponse } from "../types/quest-hours";
import type {
  WeekReviewCampaign,
  WeekReviewResponse,
  WeekReviewStanding,
} from "../types/week-review";
import {
  answersChanged,
  answersInput,
  campaignHourRows,
  clockDuration,
  dailyGoalText,
  dayBars,
  dayBarsText,
  daysPassed,
  durationParts,
  isQuietWeek,
  neighbourWeek,
  offersWayBack,
  percentOf,
  progressChange,
  questCount,
  reviewFigures,
  weekTrend,
  weekDistance,
  weekTrendText,
  weekFromQuery,
} from "./week-review";

const MONDAY = "2026-11-16";
const DATES = [16, 17, 18, 19, 20, 21, 22].map((day) => `2026-11-${day}`);

const hours = (
  overrides: Partial<QuestHoursResponse> = {},
): QuestHoursResponse => ({
  startDate: MONDAY,
  endDate: "2026-11-22",
  today: "2026-11-18",
  weeklyTargetMinutes: null,
  questMinutes: 0,
  otherMinutes: 0,
  days: DATES.map((date) => ({ date, questMinutes: 0, otherMinutes: 0 })),
  weeks: [],
  campaigns: [],
  ...overrides,
});
const standing = (
  doneCount: number,
  totalCount: number,
): WeekReviewStanding => ({
  doneCount,
  totalCount,
  percentage: Math.round((doneCount / totalCount) * 100),
  source: "live",
});
const progress = (
  start: WeekReviewStanding,
  end: WeekReviewStanding,
): WeekReviewCampaign => ({
  campaign: { id: 1, title: "Buch", color: null, icon: null },
  start,
  end,
  dailyGoals: [],
});

describe("percentOf", () => {
  it("rounds to whole percent and has none without a whole", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(5, 0)).toBeNull();
  });
});

describe("daysPassed", () => {
  const week = { startDate: MONDAY, endDate: "2026-11-22" };
  it.each([
    ["2026-11-15", 0],
    [MONDAY, 1],
    ["2026-11-18", 3],
    ["2026-11-22", 7],
    ["2026-12-01", 7],
  ])("counts the days begun by %s", (today, days) => {
    expect(daysPassed(week, today)).toBe(days);
  });
});

describe("reviewFigures", () => {
  it("sets the week against the goal, per day begun and against all time", () => {
    expect(
      reviewFigures(
        hours({ weeklyTargetMinutes: 600, questMinutes: 450, otherMinutes: 150 }),
      ),
    ).toEqual({
      questMinutes: 450,
      targetMinutes: 600,
      targetPercent: 75,
      dailyAverage: 150,
      daysPassed: 3,
      questShare: 75,
      otherMinutes: 150,
    });
  });

  it("has no percent without a goal and no share without measured time", () => {
    const figures = reviewFigures(hours({ today: "2026-11-15" }));
    expect(figures.targetPercent).toBeNull();
    expect(figures.questShare).toBeNull();
    expect(figures.dailyAverage).toBeNull();
  });
});

describe("isQuietWeek", () => {
  const review = (items: number): WeekReviewResponse =>
    ({
      days: [{ date: MONDAY, items: Array(items).fill({}) }],
    }) as WeekReviewResponse;

  it("is quiet without measured time and without anything resolved", () => {
    expect(isQuietWeek(hours(), review(0))).toBe(true);
    expect(isQuietWeek(null, null)).toBe(true);
    expect(isQuietWeek(hours({ otherMinutes: 5 }), review(0))).toBe(false);
    expect(isQuietWeek(hours(), review(1))).toBe(false);
  });
});

describe("durationParts", () => {
  it.each([
    [0, [{ value: "0", unit: "Min." }]],
    [45, [{ value: "45", unit: "Min." }]],
    [120, [{ value: "2", unit: "Std." }]],
    [
      135,
      [
        { value: "2", unit: "Std." },
        { value: "15", unit: "Min." },
      ],
    ],
  ])("splits %i minutes into numbers and units", (minutes, parts) => {
    expect(durationParts(minutes)).toEqual(parts);
  });
});

describe("clockDuration", () => {
  it("writes hours and minutes as a clock", () => {
    expect(clockDuration(0)).toBe("0:00");
    expect(clockDuration(135)).toBe("2:15");
  });
});

describe("dayBars", () => {
  it("scales the days to the longest, keeps a short one visible and marks today", () => {
    const bars = dayBars(
      hours({
        days: DATES.map((date, index) => ({
          date,
          questMinutes: [120, 2, 60, 0, 0, 0, 0][index]!,
          otherMinutes: 0,
        })),
      }),
    );
    expect(bars.map((bar) => bar.height)).toEqual([100, 3, 50, 0, 0, 0, 0]);
    expect(bars.map((bar) => bar.weekday)).toEqual([
      "Mo",
      "Di",
      "Mi",
      "Do",
      "Fr",
      "Sa",
      "So",
    ]);
    expect(bars.filter((bar) => bar.isToday).map((bar) => bar.date)).toEqual([
      "2026-11-18",
    ]);
    expect(bars.filter((bar) => bar.isAhead)).toHaveLength(4);
    expect(dayBarsText(bars)).toMatch(
      /^Kampagnen-Stunden je Tag\. Montag, 16\. Nov\.: 2 Std\., .*Donnerstag, 19\. Nov\.: noch offen/,
    );
  });
});

describe("campaignHourRows", () => {
  it("puts time and goals of all rows on one scale and leaves idle rows out", () => {
    const campaign = (id: number, minutes: number, target: number | null) => ({
      campaign: { id, title: `K${id}`, color: "berry", icon: null },
      minutes,
      weeklyTargetMinutes: target,
      weeks: [],
      totalMinutes: minutes,
    });
    const rows = campaignHourRows(
      hours({
        campaigns: [
          campaign(1, 300, 600),
          campaign(2, 150, null),
          campaign(3, 0, null),
          campaign(4, 0, 120),
        ],
      }),
    );
    expect(
      rows.map(({ id, width, targetAt }) => [id, width, targetAt]),
    ).toEqual([
      [1, 50, 100],
      [2, 25, null],
      [4, 0, 20],
    ]);
    expect(rows[0]!.mark).toBe("var(--color-mark-berry)");
  });
});

describe("progressChange", () => {
  it("says what was done and how the share moved", () => {
    expect(progressChange(progress(standing(5, 8), standing(9, 8)))).toBe(
      "+4 Quests, 63 % → 113 %",
    );
    expect(
      progressChange(
        progress(
          { ...standing(5, 8), percentage: 62 },
          { ...standing(6, 8), percentage: 71 },
        ),
      ),
    ).toBe("+1 Quest, 62 % → 71 %");
  });

  it("counts a reopened quest back and names a week without change", () => {
    expect(progressChange(progress(standing(2, 4), standing(1, 4)))).toBe(
      "−1 Quest, 50 % → 25 %",
    );
    expect(progressChange(progress(standing(2, 4), standing(2, 4)))).toBe(
      "Keine Quest erledigt, 50 %",
    );
    // New quests lower the share without anything being done.
    expect(progressChange(progress(standing(2, 4), standing(2, 8)))).toBe(
      "Keine Quest erledigt, 50 % → 25 %",
    );
    expect(progressChange(progress(standing(1, 2), standing(2, 4)))).toBe(
      "+1 Quest, weiter 50 %",
    );
  });
});

describe("dailyGoalText", () => {
  it("names runs against the target and the week's share", () => {
    const goal = {
      todoId: 1,
      habitId: 4,
      habitTitle: "Laufen",
      target: 20,
      before: 9,
      after: 12,
    };
    expect(dailyGoalText(goal)).toBe(
      "Laufen: 12 von 20 Ausführungen, +3 diese Woche",
    );
    expect(dailyGoalText({ ...goal, before: 12 })).toBe(
      "Laufen: 12 von 20 Ausführungen, keine diese Woche",
    );
  });

  it("says one run in the singular", () => {
    expect(
      dailyGoalText({
        todoId: 1,
        habitId: 4,
        habitTitle: "Laufen",
        target: 1,
        before: 0,
        after: 0,
      }),
    ).toBe("Laufen: 0 von 1 Ausführung, keine diese Woche");
  });
});

describe("questCount", () => {
  it("lets the noun follow the total", () => {
    expect(questCount(0, 1)).toBe("0 von 1 Quest");
    expect(questCount(1, 1)).toBe("1 von 1 Quest");
    expect(questCount(9, 12)).toBe("9 von 12 Quests");
    expect(questCount(0, 0)).toBe("0 von 0 Quests");
  });
});

describe("weekTrend", () => {
  const weeks = [60, 120, 0, 180, 120, 60, 120, 300].map(
    (questMinutes, index) => ({
      startDate: `2026-${index < 3 ? "09" : "10"}-${String(10 + index).padStart(2, "0")}`,
      questMinutes,
    }),
  );

  it("averages the weeks before the shown one and marks the shown one", () => {
    const trend = weekTrend(
      hours({ startDate: weeks[7]!.startDate, endDate: "2026-10-23", weeks }),
    );
    expect(trend.average).toBe(94);
    expect(trend.averageAt).toBeCloseTo((94 / 300) * 100);
    expect(trend.bars.map((bar) => bar.height)).toEqual([
      20, 40, 0, 60, 40, 20, 40, 100,
    ]);
    expect(trend.bars.filter((bar) => bar.isShown)).toHaveLength(1);
    // A week that is over is no longer "bisher".
    expect(trend.bars.some((bar) => bar.isRunning)).toBe(false);
    expect(trend.bars[0]!.label).toBe("10.09.");
    expect(weekTrendText(trend)).toMatch(
      /^Kampagnen-Stunden der letzten 8 Wochen\. Woche ab 10\. Sept\.: 1 Std\., .*5 Std\.; Schnitt der Wochen davor: 1 Std\. 34 Min\.$/,
    );
  });

  it("calls the running week's figure what it is so far", () => {
    const running = weeks.map((week, index) =>
      index === 7 ? { ...week, startDate: MONDAY } : week,
    );
    const trend = weekTrend(hours({ weeks: running }));
    expect(trend.bars.map((bar) => bar.isRunning)).toEqual([
      false, false, false, false, false, false, false, true,
    ]);
    expect(weekTrendText(trend)).toContain(
      "Woche ab 16. Nov.: 5 Std. bisher; Schnitt",
    );
  });

  it("draws no line without any time", () => {
    const trend = weekTrend(
      hours({
        weeks: weeks.map((week) => ({ ...week, questMinutes: 0 })),
      }),
    );
    expect(trend.average).toBe(0);
    expect(trend.averageAt).toBeNull();
  });
});

describe("answers", () => {
  it("shows stored answers in the fields and notices a real change", () => {
    const stored = answersInput({
      wentWell: "Viel",
      wentBadly: null,
      changeNext: null,
    });
    expect(stored).toEqual({ wentWell: "Viel", wentBadly: "", changeNext: "" });
    expect(answersChanged({ ...stored, wentWell: " Viel " }, stored)).toBe(
      false,
    );
    expect(answersChanged({ ...stored, changeNext: "Mehr" }, stored)).toBe(
      true,
    );
  });
});

describe("weekDistance", () => {
  it.each([
    ["2026-11-16", "diese Woche"],
    ["2026-11-09", "vorige Woche"],
    ["2026-11-23", "nächste Woche"],
    ["2026-10-26", "vor 3 Wochen"],
    ["2026-11-30", "in 2 Wochen"],
    // Across the change to winter time, a week is still a week.
    ["2026-10-19", "vor 4 Wochen"],
  ])("names %s from the week of 16 November as %p", (week, text) => {
    expect(weekDistance(week, "2026-11-16")).toBe(text);
  });
});

describe("weekFromQuery", () => {
  it("takes the Monday of the week in the address", () => {
    expect(weekFromQuery("2026-11-19", "2026-11-17")).toBe("2026-11-16");
  });

  it("falls back to the current week for anything else", () => {
    expect(weekFromQuery("2026-02-30", "2026-11-17")).toBe("2026-11-16");
    expect(weekFromQuery(["2026-11-23"], "2026-11-17")).toBe("2026-11-16");
    expect(weekFromQuery(undefined, "2026-11-17")).toBe("2026-11-16");
  });
});

describe("neighbourWeek and offersWayBack", () => {
  it("steps a week and offers the way back only away from the current one", () => {
    expect(neighbourWeek("2026-11-16", 1)).toBe("2026-11-23");
    expect(neighbourWeek("2026-11-16", -1)).toBe("2026-11-09");
    expect(offersWayBack("2026-11-16", "2026-11-16")).toBe(false);
    expect(offersWayBack("2026-11-23", "2026-11-16")).toBe(true);
  });
});
