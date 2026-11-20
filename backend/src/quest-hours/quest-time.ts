import { addDays, dayOf, weekRange } from '../common/date/local-day';
import type { Campaign } from '../todos/todo-ancestry';
import { WorkInterval, workedMinutesBy } from '../work-logs/work-time';
import type { QuestHoursCampaign, QuestHoursResponse } from './quest-hours.dto';

/** A stretch of work and the campaign it counts for; null counts as other. */
export type QuestInterval = WorkInterval & { campaign: Campaign | null };

/** Worked time of some days, split into quest time and the rest. */
export type QuestTime = {
  questMinutes: number;
  otherMinutes: number;
  /** Minutes per campaign id; together exactly `questMinutes`. */
  byCampaign: Map<number, number>;
};

/** How many weeks the trend looks back, the asked-for week included. */
export const TREND_WEEKS = 8;

const NOTHING: QuestTime = {
  questMinutes: 0,
  otherMinutes: 0,
  byCampaign: new Map(),
};

/**
 * Quest time of one day. It splits `workedMinutesBy` by campaign, so overlap
 * counts once and quest plus other minutes are exactly the day's worked time.
 */
export function questTimeOfDay(
  intervals: QuestInterval[],
  date: string,
): QuestTime {
  const byCampaign = new Map<number, number>();
  let otherMinutes = 0;
  const parts = workedMinutesBy(
    intervals,
    date,
    (interval) => interval.campaign?.id ?? null,
  );
  for (const [id, minutes] of parts)
    if (id === null) otherMinutes = minutes;
    else byCampaign.set(id, minutes);
  let questMinutes = 0;
  for (const minutes of byCampaign.values()) questMinutes += minutes;
  return { questMinutes, otherMinutes, byCampaign };
}

/** Days add up as they are: each was already rounded to whole minutes. */
export function addUp(times: QuestTime[]): QuestTime {
  const byCampaign = new Map<number, number>();
  let questMinutes = 0;
  let otherMinutes = 0;
  for (const time of times) {
    questMinutes += time.questMinutes;
    otherMinutes += time.otherMinutes;
    for (const [id, minutes] of time.byCampaign)
      byCampaign.set(id, (byCampaign.get(id) ?? 0) + minutes);
  }
  return { questMinutes, otherMinutes, byCampaign };
}

/** The app days a stretch has time on, first to last. */
function daysOf({ startedAt, endedAt }: WorkInterval): string[] {
  const last = dayOf(new Date(endedAt.getTime() - 1));
  const days = [dayOf(startedAt)];
  while (days[days.length - 1] < last)
    days.push(addDays(days[days.length - 1], 1));
  return days;
}

/** Quest time of every day the stretches cover, keyed by day. */
export function questTimeByDay(
  intervals: QuestInterval[],
): Map<string, QuestTime> {
  const logsOfDay = new Map<string, QuestInterval[]>();
  for (const interval of intervals)
    for (const date of daysOf(interval)) {
      const logs = logsOfDay.get(date);
      if (logs) logs.push(interval);
      else logsOfDay.set(date, [interval]);
    }
  return new Map(
    [...logsOfDay].map(([date, logs]) => [date, questTimeOfDay(logs, date)]),
  );
}

const timeOf = (byDay: Map<string, QuestTime>, dates: string[]): QuestTime =>
  addUp(dates.map((date) => byDay.get(date) ?? NOTHING));

const sevenDays = (monday: string): string[] =>
  Array.from({ length: 7 }, (_, index) => addDays(monday, index));

/**
 * The quest hours of the week from Monday `start`: each day, each campaign
 * with time ever or a weekly goal, and the trend of the weeks up to this one.
 * `intervals` are all of the user's stretches, so totals cover every day.
 */
export function questWeek(
  intervals: QuestInterval[],
  start: string,
  targets: { campaign: Campaign; minutes: number }[],
): Omit<QuestHoursResponse, 'today' | 'weeklyTargetMinutes'> {
  const byDay = questTimeByDay(intervals);
  const dates = sevenDays(start);
  const week = timeOf(byDay, dates);
  const starts = Array.from({ length: TREND_WEEKS }, (_, index) =>
    addDays(start, (index - TREND_WEEKS + 1) * 7),
  );
  const weeks = starts.map((monday) => timeOf(byDay, sevenDays(monday)));
  const ever = addUp([...byDay.values()]);

  const campaigns = new Map<number, Campaign>();
  for (const { campaign } of intervals)
    if (campaign && ever.byCampaign.get(campaign.id))
      campaigns.set(campaign.id, campaign);
  const goals = new Map<number, number>();
  for (const { campaign, minutes } of targets) {
    campaigns.set(campaign.id, campaign);
    goals.set(campaign.id, minutes);
  }
  const rows: QuestHoursCampaign[] = [...campaigns.values()].map(
    (campaign) => ({
      campaign,
      minutes: week.byCampaign.get(campaign.id) ?? 0,
      weeklyTargetMinutes: goals.get(campaign.id) ?? null,
      weeks: weeks.map((time) => time.byCampaign.get(campaign.id) ?? 0),
      totalMinutes: ever.byCampaign.get(campaign.id) ?? 0,
    }),
  );
  rows.sort(
    (a, b) =>
      b.minutes - a.minutes ||
      a.campaign.title.localeCompare(b.campaign.title, 'de') ||
      a.campaign.id - b.campaign.id,
  );
  return {
    startDate: dates[0],
    endDate: dates[6],
    questMinutes: week.questMinutes,
    otherMinutes: week.otherMinutes,
    totalQuestMinutes: ever.questMinutes,
    days: dates.map((date) => {
      const { questMinutes, otherMinutes } = byDay.get(date) ?? NOTHING;
      return { date, questMinutes, otherMinutes };
    }),
    weeks: starts.map((startDate, index) => ({
      startDate,
      questMinutes: weeks[index].questMinutes,
    })),
    campaigns: rows,
  };
}

/** Quest minutes of `today` and of its week (Monday to Sunday). */
export function questSoFar(
  intervals: QuestInterval[],
  today: string,
): { todayMinutes: number; weekMinutes: number } {
  const byDay = questTimeByDay(intervals);
  return {
    todayMinutes: byDay.get(today)?.questMinutes ?? 0,
    weekMinutes: timeOf(byDay, sevenDays(weekRange(today).startDate))
      .questMinutes,
  };
}
