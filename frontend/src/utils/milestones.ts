import type { MonthChallenges } from "../types/month-challenge";
import type { QuestHoursResponse } from "../types/quest-hours";
import type { WeekReviewResponse } from "../types/week-review";

/**
 * The milestones a short sound celebrates (docs/focus-sounds.md, "Töne"),
 * decided by comparing what the server said right before an action of this
 * tab with what it says right after. Pure: no requests, no storage.
 */
export type MilestoneKind = "quest-hours" | "perfect-week" | "month-challenge";

/**
 * Where one milestone stands in its period (a week's Monday, a month
 * "YYYY-MM"); null when there is nothing to reach (no weekly goal, no
 * category with a weekly target, no running challenge).
 */
export type MilestoneReading = { period: string; reached: boolean } | null;

/** What is known about each milestone; a missing kind was not read. */
export type MilestoneSnapshot = Partial<Record<MilestoneKind, MilestoneReading>>;

export const MILESTONE_KINDS: readonly MilestoneKind[] = [
  "quest-hours",
  "perfect-week",
  "month-challenge",
];

/** The key a milestone is remembered by, once per period. */
export const milestoneKey = (kind: MilestoneKind, period: string): string =>
  `${kind}:${period}`;

/** The current period of each kind, from the Berlin day `today`. */
export function currentPeriods(
  today: string,
  monday: string,
): Record<MilestoneKind, string> {
  return {
    "quest-hours": monday,
    "perfect-week": monday,
    "month-challenge": today.slice(0, 7),
  };
}

/** The Wochenziel der Quest-Stunden: the week's quest minutes against the goal. */
export function questHoursReading(
  response: QuestHoursResponse,
): MilestoneReading {
  const target = response.weeklyTargetMinutes;
  if (target === null || target <= 0) return null;
  return {
    period: response.startDate,
    reached: response.questMinutes >= target,
  };
}

/** The Perfect Week, as the weekly review counts it. */
export function perfectWeekReading(
  response: WeekReviewResponse,
): MilestoneReading {
  if (!response.perfectWeek) return null;
  return { period: response.startDate, reached: response.perfectWeek.perfect };
}

/** This month's Monats-Challenge at 100 %: every due run done. */
export function monthChallengeReading(
  response: MonthChallenges,
): MilestoneReading {
  const current = response.current;
  if (
    !current ||
    current.total <= 0 ||
    current.status === "upcoming" ||
    current.status === "ended"
  )
    return null;
  return { period: current.month, reached: current.done >= current.total };
}

/**
 * The kinds an action may still reach: not already met in this period,
 * judged before any request by the remembered keys.
 */
export function unmetKinds(
  kinds: readonly MilestoneKind[],
  periods: Record<MilestoneKind, string>,
  seen: ReadonlySet<string>,
): MilestoneKind[] {
  return kinds.filter((kind) => !seen.has(milestoneKey(kind, periods[kind])));
}

/**
 * Keys of milestones the snapshot shows as reached already. They are
 * remembered without a sound: reached before (or elsewhere), so an action
 * here does not reach them "for the first time".
 */
export function reachedKeys(snapshot: MilestoneSnapshot): string[] {
  return MILESTONE_KINDS.flatMap((kind) => {
    const reading = snapshot[kind];
    return reading?.reached ? [milestoneKey(kind, reading.period)] : [];
  });
}

/** The kinds whose state before the action leaves something to reach. */
export function openKinds(
  before: MilestoneSnapshot,
  seen: ReadonlySet<string>,
): MilestoneKind[] {
  return MILESTONE_KINDS.filter((kind) => {
    const reading = before[kind];
    return (
      !!reading &&
      !reading.reached &&
      !seen.has(milestoneKey(kind, reading.period))
    );
  });
}

/**
 * The milestones the action reached for the first time: below before, at or
 * above after, in the same period, and not celebrated in it yet. Without a
 * reading from before (none taken, or it failed) nothing counts, so a page
 * load or a poll never celebrates.
 */
export function newlyReached(
  before: MilestoneSnapshot,
  after: MilestoneSnapshot,
  seen: ReadonlySet<string>,
): MilestoneKind[] {
  return openKinds(before, seen).filter((kind) => {
    const was = before[kind]!;
    const now = after[kind];
    return !!now && now.reached && now.period === was.period;
  });
}
