import type { QuestHoursResponse } from "../types/quest-hours";
import type {
  WeekReviewCampaign,
  WeekReviewResponse,
  WeekReviewStanding,
} from "../types/week-review";

/** The week of Monday 16 November 2026; today is its Wednesday. */
export const MONDAY = "2026-11-16";
export const TODAY = "2026-11-18";

const datesFrom = (start: string): string[] =>
  Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${start}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });

/** Quest hours of a week without any measured time, eight weeks of trend. */
export function questHours(
  overrides: Partial<QuestHoursResponse> = {},
): QuestHoursResponse {
  const start = overrides.startDate ?? MONDAY;
  const dates = datesFrom(start);
  return {
    startDate: start,
    endDate: dates[6]!,
    today: TODAY,
    weeklyTargetMinutes: null,
    questMinutes: 0,
    otherMinutes: 0,
    totalQuestMinutes: 0,
    days: dates.map((date) => ({ date, questMinutes: 0, otherMinutes: 0 })),
    weeks: Array.from({ length: 8 }, (_, index) => {
      const date = new Date(`${start}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() - (7 - index) * 7);
      return {
        startDate: date.toISOString().slice(0, 10),
        questMinutes: 0,
        otherMinutes: 0,
      };
    }),
    campaigns: [],
    ...overrides,
  };
}

/** A review of a week in which nothing was resolved and nothing written. */
export function weekReview(
  overrides: Partial<WeekReviewResponse> = {},
): WeekReviewResponse {
  const start = overrides.startDate ?? MONDAY;
  const dates = datesFrom(start);
  return {
    startDate: start,
    endDate: dates[6]!,
    today: TODAY,
    campaigns: [],
    weekQuota: null,
    perfectWeek: null,
    days: dates.map((date) => ({ date, items: [] })),
    answers: { wentWell: null, wentBadly: null, changeNext: null },
    ...overrides,
  };
}

export function standing(
  doneCount: number,
  totalCount: number,
  source: WeekReviewStanding["source"] = "live",
): WeekReviewStanding {
  return {
    doneCount,
    totalCount,
    percentage: totalCount ? Math.round((doneCount / totalCount) * 100) : 0,
    source,
  };
}

export function campaignRow(
  overrides: Partial<WeekReviewCampaign> = {},
): WeekReviewCampaign {
  return {
    campaign: { id: 5, title: "Buch", color: "berry", icon: "book" },
    start: standing(5, 8, "snapshot"),
    end: standing(9, 12),
    dailyGoals: [],
    ...overrides,
  };
}
