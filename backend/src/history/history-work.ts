import type { Campaign } from '../todos/todo-ancestry';
import type { CampaignLog } from '../work-logs/day-logs';
import {
  lengthInMinutes,
  onDay,
  workedMinutes,
  workedMinutesBy,
} from '../work-logs/work-time';
import type {
  HistoryDayWork,
  HistoryWorkLog,
  HistoryWorkShare,
} from './history.dto';

/** What the calendar shows of a work log. */
export type DayLog = Pick<
  CampaignLog,
  | 'id'
  | 'title'
  | 'startedAt'
  | 'endedAt'
  | 'source'
  | 'todoId'
  | 'occurrenceId'
  | 'habitId'
  | 'campaign'
>;

/**
 * The Logbuch of one day. Without `detailed` (the month) only the minutes;
 * otherwise also the share of each campaign, largest first and work without
 * a campaign last, and the stretches themselves.
 */
export function dayWork(
  logs: DayLog[],
  date: string,
  detailed: boolean,
): HistoryDayWork {
  const minutes = workedMinutes(logs, date);
  if (!detailed) return { minutes };
  const campaigns = new Map<number, Campaign>();
  for (const log of logs)
    if (log.campaign) campaigns.set(log.campaign.id, log.campaign);
  const shares: HistoryWorkShare[] = [
    ...workedMinutesBy(logs, date, (log) => log.campaign?.id ?? null),
  ]
    .filter(([, part]) => part > 0)
    .map(([id, part]) => ({
      campaign: id === null ? null : campaigns.get(id)!,
      minutes: part,
    }))
    .sort(
      (a, b) =>
        Number(a.campaign === null) - Number(b.campaign === null) ||
        b.minutes - a.minutes ||
        (a.campaign?.title ?? '').localeCompare(b.campaign?.title ?? '', 'de'),
    );
  const onThisDay = new Set(onDay(logs, date).map((log) => log.id));
  return {
    minutes,
    campaigns: shares,
    logs: logs.filter((log) => onThisDay.has(log.id)).map(workLogItem),
  };
}

function workLogItem(log: DayLog): HistoryWorkLog {
  return {
    id: log.id,
    title: log.title,
    startedAt: log.startedAt.toISOString(),
    endedAt: log.endedAt.toISOString(),
    minutes: lengthInMinutes(log),
    source: log.source,
    todoId: log.todoId,
    occurrenceId: log.occurrenceId,
    habitId: log.habitId,
    campaign: log.campaign,
  };
}
