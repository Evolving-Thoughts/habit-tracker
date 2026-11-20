import type { QuestHoursResponse } from "../types/quest-hours";
import type {
  WeekReviewAnswers,
  WeekReviewCampaign,
  WeekReviewDailyGoal,
  WeekReviewInput,
  WeekReviewResponse,
} from "../types/week-review";
import { campaignMark } from "./category-mark";
import { addDays } from "./date";
import { dayLabel, shortDate } from "./history";
import { formatDuration } from "./today-agenda";
import { questWord } from "./todo-hierarchy";

const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Whole percent of `part` in `whole`; null when there is no whole. */
export function percentOf(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/** Days of the week that have begun: all seven once it is over, none ahead. */
export function daysPassed(
  week: { startDate: string; endDate: string },
  today: string,
): number {
  if (today > week.endDate) return 7;
  if (today < week.startDate) return 0;
  let days = 1;
  while (addDays(week.startDate, days) <= today) days += 1;
  return days;
}

/** The key figures of the week, all from the quest hours. */
export type ReviewFigures = {
  questMinutes: number;
  /** The overall goal; null without one. */
  targetMinutes: number | null;
  /** Of the goal; null without one. */
  targetPercent: number | null;
  /** Quest minutes per day that has begun; null before the week starts. */
  dailyAverage: number | null;
  daysPassed: number;
  /** Quest work in all measured time; null without any measured time. */
  questShare: number | null;
  otherMinutes: number;
};

export function reviewFigures(hours: QuestHoursResponse): ReviewFigures {
  const passed = daysPassed(hours, hours.today);
  const target = hours.weeklyTargetMinutes;
  return {
    questMinutes: hours.questMinutes,
    targetMinutes: target,
    targetPercent: target === null ? null : percentOf(hours.questMinutes, target),
    dailyAverage: passed ? Math.round(hours.questMinutes / passed) : null,
    daysPassed: passed,
    questShare: percentOf(
      hours.questMinutes,
      hours.questMinutes + hours.otherMinutes,
    ),
    otherMinutes: hours.otherMinutes,
  };
}

/** Whether nothing was measured and nothing resolved: the calm empty week. */
export function isQuietWeek(
  hours: QuestHoursResponse | null,
  review: WeekReviewResponse | null,
): boolean {
  const measured = hours ? hours.questMinutes + hours.otherMinutes : 0;
  const resolved = review
    ? review.days.some((day) => day.items.length > 0)
    : false;
  return !measured && !resolved;
}

/** A figure split into number and unit, so the unit can sit smaller. */
export type FigurePart = { value: string; unit: string };

/** "2 Std. 15 Min." in parts; the same words as `formatDuration`. */
export function durationParts(minutes: number): FigurePart[] {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts: FigurePart[] = [];
  if (hours) parts.push({ value: String(hours), unit: "Std." });
  if (rest || !hours) parts.push({ value: String(rest), unit: "Min." });
  return parts;
}

/** "2:15", the bars' figure where "2 Std. 15 Min." does not fit. */
export function clockDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Height of a bar in percent of the highest; a sliver keeps time visible. */
function barHeight(minutes: number, top: number): number {
  if (!minutes || !top) return 0;
  return Math.max(3, Math.round((minutes / top) * 100));
}

export type DayBar = {
  date: string;
  /** "Mo" … "So". */
  weekday: string;
  minutes: number;
  height: number;
  isToday: boolean;
  /** A day still ahead has no time yet; it shows a dash, not a zero. */
  isAhead: boolean;
};

/** Quest minutes of each day, Monday to Sunday, scaled to the longest day. */
export function dayBars(hours: QuestHoursResponse): DayBar[] {
  const top = Math.max(0, ...hours.days.map((day) => day.questMinutes));
  return hours.days.map((day, index) => ({
    date: day.date,
    weekday: WEEKDAY_SHORT[index] ?? "",
    minutes: day.questMinutes,
    height: barHeight(day.questMinutes, top),
    isToday: day.date === hours.today,
    isAhead: day.date > hours.today,
  }));
}

/** The day bars in words, for those who cannot see them. */
export function dayBarsText(bars: DayBar[]): string {
  const parts = bars.map(
    (bar) =>
      `${dayLabel(bar.date)}: ${bar.isAhead ? "noch offen" : formatDuration(bar.minutes)}`,
  );
  return `Kampagnen-Stunden je Tag. ${parts.join(", ")}`;
}

export type CampaignHoursRow = {
  id: number;
  title: string;
  mark: string;
  minutes: number;
  targetMinutes: number | null;
  /** Width of the bar and position of the goal, on one shared scale. */
  width: number;
  targetAt: number | null;
};

/**
 * Campaigns with time this week or a weekly goal. All rows share one scale,
 * the most time or the highest goal, so lengths compare across rows.
 */
export function campaignHourRows(hours: QuestHoursResponse): CampaignHoursRow[] {
  const rows = hours.campaigns.filter(
    (row) => row.minutes > 0 || row.weeklyTargetMinutes !== null,
  );
  const top = Math.max(
    1,
    ...rows.map((row) => Math.max(row.minutes, row.weeklyTargetMinutes ?? 0)),
  );
  const at = (minutes: number): number =>
    Math.min(100, (minutes / top) * 100);
  return rows.map((row) => ({
    id: row.campaign.id,
    title: row.campaign.title,
    mark: campaignMark(row.campaign)!,
    minutes: row.minutes,
    targetMinutes: row.weeklyTargetMinutes,
    width: at(row.minutes),
    targetAt:
      row.weeklyTargetMinutes === null ? null : at(row.weeklyTargetMinutes),
  }));
}

/** "0 von 1 Quest", "9 von 12 Quests": the noun follows the total. */
export function questCount(done: number, total: number): string {
  return `${done} von ${total} ${questWord(total)}`;
}

/** Quests done this week: the end against the start. */
export function questsGained(row: WeekReviewCampaign): number {
  return row.end.doneCount - row.start.doneCount;
}

/**
 * The change of a campaign in words and numbers: "+4 Quests, 62 % → 71 %".
 * A reopened quest counts back ("−1 Quest"); nothing done says so.
 */
export function progressChange(row: WeekReviewCampaign): string {
  const gained = questsGained(row);
  const from = row.start.percentage;
  const to = row.end.percentage;
  const moved = `${from} % → ${to} %`;
  if (!gained)
    return `Keine Quest erledigt, ${from === to ? `${to} %` : moved}`;
  const count = Math.abs(gained);
  const sign = gained > 0 ? "+" : "−";
  const quests = `${sign}${count} ${questWord(count)}`;
  return `${quests}, ${from === to ? `weiter ${to} %` : moved}`;
}

/** "Laufen: 12 von 20 Ausführungen, +3 diese Woche"; "0 von 1 Ausführung". */
export function dailyGoalText(goal: WeekReviewDailyGoal): string {
  const gained = goal.after - goal.before;
  const name = goal.habitTitle ? `${goal.habitTitle}: ` : "";
  const change = gained > 0 ? `, +${gained} diese Woche` : ", keine diese Woche";
  const runs = goal.target === 1 ? "Ausführung" : "Ausführungen";
  return `${name}${goal.after} von ${goal.target} ${runs}${change}`;
}

export type WeekBar = {
  startDate: string;
  /** "16.11." */
  label: string;
  minutes: number;
  height: number;
  isShown: boolean;
  /** The shown week while it still runs: its figure is "bisher". */
  isRunning: boolean;
};

export type WeekTrend = {
  bars: WeekBar[];
  /** Mean of the weeks before the shown one; null when there are none. */
  average: number | null;
  /** Where the average line sits, in percent of the chart's height. */
  averageAt: number | null;
};

/**
 * The eight weeks up to the shown one. The average leaves the shown week
 * out: it may still be running, and it is what the line is compared with.
 */
export function weekTrend(hours: QuestHoursResponse): WeekTrend {
  const before = hours.weeks.slice(0, -1);
  const average = before.length
    ? Math.round(
        before.reduce((sum, week) => sum + week.questMinutes, 0) /
          before.length,
      )
    : null;
  const top = Math.max(
    average ?? 0,
    ...hours.weeks.map((week) => week.questMinutes),
  );
  const running =
    hours.startDate <= hours.today && hours.today <= hours.endDate;
  return {
    bars: hours.weeks.map((week) => {
      const isShown = week.startDate === hours.startDate;
      return {
        startDate: week.startDate,
        label: `${week.startDate.slice(8, 10)}.${week.startDate.slice(5, 7)}.`,
        minutes: week.questMinutes,
        height: barHeight(week.questMinutes, top),
        isShown,
        isRunning: isShown && running,
      };
    }),
    average,
    averageAt: average === null || !top ? null : (average / top) * 100,
  };
}

/** The weeks in words, the average included. */
export function weekTrendText(trend: WeekTrend): string {
  const parts = trend.bars.map(
    (bar) =>
      `Woche ab ${shortDate(bar.startDate)}: ${formatDuration(bar.minutes)}${bar.isRunning ? " bisher" : ""}`,
  );
  const average =
    trend.average === null
      ? ""
      : `; Schnitt der Wochen davor: ${formatDuration(trend.average)}`;
  return `Kampagnen-Stunden der letzten ${trend.bars.length} Wochen. ${parts.join(", ")}${average}`;
}

/** What the answer fields show for stored answers. */
export function answersInput(answers: WeekReviewAnswers): WeekReviewInput {
  return {
    wentWell: answers.wentWell ?? "",
    wentBadly: answers.wentBadly ?? "",
    changeNext: answers.changeNext ?? "",
  };
}

/** Whether the fields differ from what is stored, ignoring outer spaces. */
export function answersChanged(
  input: WeekReviewInput,
  stored: WeekReviewInput,
): boolean {
  return (Object.keys(input) as (keyof WeekReviewInput)[]).some(
    (key) => input[key].trim() !== stored[key].trim(),
  );
}

/** "diese Woche", "vorige Woche", "vor 3 Wochen", "in 2 Wochen". */
export function weekDistance(week: string, thisWeek: string): string {
  const weeks = Math.round(
    (Date.parse(`${week}T12:00:00Z`) - Date.parse(`${thisWeek}T12:00:00Z`)) /
      (7 * 86_400_000),
  );
  if (weeks === 0) return "diese Woche";
  if (weeks === -1) return "vorige Woche";
  if (weeks === 1) return "nächste Woche";
  return weeks < 0 ? `vor ${-weeks} Wochen` : `in ${weeks} Wochen`;
}
