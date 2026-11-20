import type { QuestHoursResponse } from "../types/quest-hours";
import type { HierarchyTodo } from "../types/todo-hierarchy";
import { isCampaign } from "./todo-hierarchy";
import { formatDuration } from "./today-agenda";
import { isCampaignColor, isCampaignIcon } from "./campaign-style";
import type { CampaignColor, CampaignIcon } from "../types/campaign";

/** Up to 100 hours a week, like the server allows. */
export const MAX_TARGET_HOURS = 100;

const TARGET_MESSAGE = `Das Wochenziel ist eine Zahl von 0,5 bis ${MAX_TARGET_HOURS} Stunden in halben Stunden.`;

/**
 * Minutes from an hours field: empty is no goal, halves are allowed ("3,5"
 * as well as "3.5"). Throws a message for anything else.
 */
export function hoursToMinutes(value: string | number): number | null {
  const text = String(value).trim().replace(",", ".");
  if (!text) return null;
  const hours = Number(text);
  if (
    !Number.isFinite(hours) ||
    hours < 0.5 ||
    hours > MAX_TARGET_HOURS ||
    !Number.isInteger(hours * 2)
  )
    throw new Error(TARGET_MESSAGE);
  return Math.round(hours * 60);
}

/** What an hours field shows for stored minutes; empty without a goal. */
export function minutesToHours(minutes: number | null): string {
  if (minutes === null) return "";
  return String(Math.round((minutes / 60) * 100) / 100);
}

/**
 * ["3 Std. 30 Min.", "von 6 Std."]: the figures with their words, so a line
 * may wrap between them but never inside one; just the time without a goal.
 */
export function againstTargetParts(
  minutes: number,
  target: number | null,
): string[] {
  return target === null
    ? [formatDuration(minutes)]
    : [formatDuration(minutes), `von ${formatDuration(target)}`];
}

/** "3 Std. 30 Min. von 6 Std."; just the time without a goal. */
export function againstTarget(minutes: number, target: number | null): string {
  return againstTargetParts(minutes, target).join(" ");
}

/**
 * The one time line in the head of Heute. It puts the two figures in
 * relation instead of side by side: what was worked today, how much of it
 * went to campaigns (the quest hours), then the quest hours of the week
 * against the goal. Both figures come from the same stretches, so the part
 * on campaigns is never more than the whole.
 *
 * - "1 Std. 40 Min. gearbeitet, davon 1 Std. 20 Min. auf Kampagnen · Woche
 *   4 Std. 11 Min. von 20 Std."
 * - all of it on campaigns: "…, alles auf Kampagnen"; none: just "40 Min.
 *   gearbeitet", and the week names what it counts ("Kampagnen diese Woche").
 * - nothing worked today: only the week; neither week time nor a goal: null.
 */
export function workLine(
  workedMinutes: number,
  hours: {
    todayMinutes: number;
    weekMinutes: number;
    weeklyTargetMinutes: number | null;
  },
): string | null {
  const parts: string[] = [];
  const onCampaigns = Math.min(hours.todayMinutes, workedMinutes);
  if (workedMinutes > 0) {
    const worked = `${formatDuration(workedMinutes)} gearbeitet`;
    parts.push(
      onCampaigns === 0
        ? worked
        : onCampaigns === workedMinutes
          ? `${worked}, alles auf Kampagnen`
          : `${worked}, davon ${formatDuration(onCampaigns)} auf Kampagnen`,
    );
  }
  if (hours.weekMinutes > 0 || hours.weeklyTargetMinutes !== null) {
    const week = againstTarget(hours.weekMinutes, hours.weeklyTargetMinutes);
    parts.push(
      onCampaigns > 0 ? `Woche ${week}` : `Kampagnen diese Woche ${week}`,
    );
  }
  return parts.length ? parts.join(" · ") : null;
}

/** A campaign as its tile shows it. */
export type CampaignTile = {
  todo: HierarchyTodo;
  color: CampaignColor | null;
  icon: CampaignIcon | null;
  minutes: number;
  weeklyTargetMinutes: number | null;
  /** Minutes of each of the trend's weeks, oldest first. */
  weeks: number[];
  totalMinutes: number;
};

/**
 * One tile per campaign: a quest without parent that has quests below it,
 * a goal, colour or icon, or measured time the server counts for it. Loose
 * top-level quests are no campaign and stay out (they live in the Questlog).
 */
export function campaignTiles(
  todos: HierarchyTodo[],
  hours: QuestHoursResponse | null,
): CampaignTile[] {
  const parents = new Set(todos.map((todo) => todo.parentId));
  const counted = new Map(
    (hours?.campaigns ?? []).map((row) => [row.campaign.id, row]),
  );
  const empty = (hours?.weeks ?? []).map(() => 0);
  return todos
    .filter(
      (todo) =>
        isCampaign(todo, parents) ||
        (todo.parentId === null && counted.has(todo.id)),
    )
    .map((todo) => {
      const row = counted.get(todo.id);
      return {
        todo,
        color: isCampaignColor(todo.color) ? todo.color : null,
        icon: isCampaignIcon(todo.icon) ? todo.icon : null,
        minutes: row?.minutes ?? 0,
        weeklyTargetMinutes: todo.weeklyTargetMinutes,
        weeks: row?.weeks ?? empty,
        totalMinutes: row?.totalMinutes ?? 0,
      };
    });
}

/**
 * The trend in words, for those who cannot see the line: "Letzte 8 Wochen:
 * ab 28.09. 2 Std., …, diese Woche 4 Std.". The week starting on
 * `currentStart` is "diese Woche".
 */
export function trendText(
  weeks: number[],
  starts: string[],
  formatStart: (date: string) => string,
  currentStart?: string,
): string {
  const parts = weeks.map((minutes, index) => {
    const start = starts[index] ?? "";
    const week =
      start === currentStart ? "diese Woche" : `ab ${formatStart(start)}`;
    return `${week} ${formatDuration(minutes)}`;
  });
  return `Letzte ${weeks.length} Wochen: ${parts.join(", ")}`;
}
