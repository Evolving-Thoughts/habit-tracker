import type { QuestHoursResponse } from "../types/quest-hours";
import type { HierarchyTodo } from "../types/todo-hierarchy";
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

/** "3 Std. 30 Min. von 6 Std."; just the time without a goal. */
export function againstTarget(minutes: number, target: number | null): string {
  return target === null
    ? formatDuration(minutes)
    : `${formatDuration(minutes)} von ${formatDuration(target)}`;
}

/**
 * The quiet line in the head of Heute. Nothing while there is neither
 * measured quest time this week nor a goal.
 */
export function questHoursLine(hours: {
  todayMinutes: number;
  weekMinutes: number;
  weeklyTargetMinutes: number | null;
}): string | null {
  if (!hours.weekMinutes && hours.weeklyTargetMinutes === null) return null;
  return `Quest-Stunden heute ${formatDuration(hours.todayMinutes)} · Woche ${againstTarget(hours.weekMinutes, hours.weeklyTargetMinutes)}`;
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
 * top-level quests stay in the list below the tiles only.
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
        todo.parentId === null &&
        (parents.has(todo.id) ||
          todo.weeklyTargetMinutes !== null ||
          todo.color !== null ||
          todo.icon !== null ||
          counted.has(todo.id)),
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

/** The trend in words, for those who cannot see the line. */
export function trendText(
  weeks: number[],
  starts: string[],
  formatStart: (date: string) => string,
): string {
  const parts = weeks.map(
    (minutes, index) =>
      `Woche ab ${formatStart(starts[index] ?? "")}: ${formatDuration(minutes)}`,
  );
  return `Quest-Stunden der letzten ${weeks.length} Wochen. ${parts.join(", ")}`;
}
