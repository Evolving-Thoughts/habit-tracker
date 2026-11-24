import { describe, expect, it } from "vitest";
import type { MonthChallenge, MonthChallenges } from "../types/month-challenge";
import type { QuestHoursResponse } from "../types/quest-hours";
import type { WeekReviewResponse } from "../types/week-review";
import {
  currentPeriods,
  milestoneKey,
  monthChallengeReading,
  newlyReached,
  openKinds,
  perfectWeekReading,
  questHoursReading,
  reachedKeys,
  unmetKinds,
  type MilestoneSnapshot,
} from "./milestones";

const WEEK = "2026-11-23";

const hours = (questMinutes: number, target: number | null) =>
  ({
    startDate: WEEK,
    weeklyTargetMinutes: target,
    questMinutes,
  }) as QuestHoursResponse;

const review = (perfect: boolean | null) =>
  ({
    startDate: WEEK,
    perfectWeek:
      perfect === null ? null : { perfect, categories: [] },
  }) as unknown as WeekReviewResponse;

const challenges = (
  current: Partial<MonthChallenge> | null,
): MonthChallenges => ({
  today: "2026-11-30",
  current: current
    ? ({
        month: "2026-11",
        status: "running",
        done: 29,
        total: 30,
        ...current,
      } as MonthChallenge)
    : null,
  next: null,
  past: [],
});

describe("readings", () => {
  it("the weekly quest-hours goal: minutes against the goal of that week", () => {
    expect(questHoursReading(hours(599, 600))).toEqual({
      period: WEEK,
      reached: false,
    });
    expect(questHoursReading(hours(600, 600))?.reached).toBe(true);
    expect(questHoursReading(hours(900, null))).toBeNull();
    expect(questHoursReading(hours(5, 0))).toBeNull();
  });

  it("the Perfect Week, null without any category target", () => {
    expect(perfectWeekReading(review(true))).toEqual({
      period: WEEK,
      reached: true,
    });
    expect(perfectWeekReading(review(false))?.reached).toBe(false);
    expect(perfectWeekReading(review(null))).toBeNull();
  });

  it("the Monats-Challenge at 100 %, only for this month's live challenge", () => {
    expect(monthChallengeReading(challenges({}))).toEqual({
      period: "2026-11",
      reached: false,
    });
    expect(
      monthChallengeReading(challenges({ done: 30, status: "succeeded" })),
    ).toEqual({ period: "2026-11", reached: true });
    expect(monthChallengeReading(challenges(null))).toBeNull();
    expect(monthChallengeReading(challenges({ status: "ended" }))).toBeNull();
    expect(
      monthChallengeReading(challenges({ status: "upcoming" })),
    ).toBeNull();
    expect(
      monthChallengeReading(challenges({ done: 0, total: 0 })),
    ).toBeNull();
  });

  it("periods: the week's Monday, the month", () => {
    expect(currentPeriods("2026-11-24", WEEK)).toEqual({
      "quest-hours": WEEK,
      "perfect-week": WEEK,
      "month-challenge": "2026-11",
    });
  });
});

describe("detection", () => {
  const below: MilestoneSnapshot = {
    "quest-hours": { period: WEEK, reached: false },
    "perfect-week": { period: WEEK, reached: false },
    "month-challenge": { period: "2026-11", reached: false },
  };
  const none = new Set<string>();

  it("finds each milestone crossed by the action", () => {
    expect(
      newlyReached(
        below,
        { ...below, "quest-hours": { period: WEEK, reached: true } },
        none,
      ),
    ).toEqual(["quest-hours"]);
    expect(
      newlyReached(
        below,
        { ...below, "perfect-week": { period: WEEK, reached: true } },
        none,
      ),
    ).toEqual(["perfect-week"]);
    expect(
      newlyReached(
        below,
        { ...below, "month-challenge": { period: "2026-11", reached: true } },
        none,
      ),
    ).toEqual(["month-challenge"]);
    expect(newlyReached(below, below, none)).toEqual([]);
  });

  it("celebrates once per period", () => {
    const after: MilestoneSnapshot = {
      "perfect-week": { period: WEEK, reached: true },
    };
    const seen = new Set([milestoneKey("perfect-week", WEEK)]);
    expect(newlyReached(below, after, seen)).toEqual([]);
    expect(openKinds(below, seen)).toEqual(["quest-hours", "month-challenge"]);
    // The next week starts afresh.
    expect(
      unmetKinds(
        ["perfect-week"],
        currentPeriods("2026-11-30", "2026-11-30"),
        seen,
      ),
    ).toEqual(["perfect-week"]);
    expect(
      unmetKinds(["perfect-week"], currentPeriods("2026-11-24", WEEK), seen),
    ).toEqual([]);
  });

  it("never fires without a reading from before: a load or a poll", () => {
    const after: MilestoneSnapshot = {
      "quest-hours": { period: WEEK, reached: true },
      "perfect-week": { period: WEEK, reached: true },
      "month-challenge": { period: "2026-11", reached: true },
    };
    expect(newlyReached({}, after, none)).toEqual([]);
    // Nothing to reach before (no goal): nothing to celebrate after.
    expect(newlyReached({ "quest-hours": null }, after, none)).toEqual([]);
  });

  it("does not count what was reached already, and remembers it quietly", () => {
    const reached: MilestoneSnapshot = {
      ...below,
      "perfect-week": { period: WEEK, reached: true },
    };
    expect(newlyReached(reached, reached, none)).toEqual([]);
    expect(reachedKeys(reached)).toEqual([milestoneKey("perfect-week", WEEK)]);
    expect(openKinds(reached, none)).toEqual(["quest-hours", "month-challenge"]);
  });

  it("does not compare across periods, nor with a failed read after", () => {
    expect(
      newlyReached(
        below,
        { "perfect-week": { period: "2026-11-30", reached: true } },
        none,
      ),
    ).toEqual([]);
    expect(newlyReached(below, {}, none)).toEqual([]);
  });
});
