import { IsIn, IsOptional, IsString } from 'class-validator';
import type { Campaign } from '../todos/todo-ancestry';
import type { WorkLogSource } from '../work-logs/work-log.entity';
import type { PerfectWeek } from './perfect-week';
import type { WeekQuota } from './week-quota';
export class HistoryQueryDto {
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsIn(['day', 'week', 'month']) view?: 'day' | 'week' | 'month';
  @IsOptional() @IsIn(['all', 'todos', 'habits']) filter?:
    'all' | 'todos' | 'habits';
}
export type HistoryItem = {
  type: 'todo' | 'habit';
  id: number;
  habitId: number | null;
  title: string;
  categoryName: string | null;
  /** The reason to show: its own, else the inherited one. */
  why: string | null;
  status: 'completed' | 'skipped';
  date: string;
  scheduledDate: string | null;
  resolvedAt: string | null;
  plannedDurationMinutes: number | null;
  /** HH:mm of an appointment or timed habit, as it was planned. */
  timeOfDay: string | null;
  deleted: boolean;
};
export type HistoryPlannedItem = {
  key: string;
  type: 'todo' | 'habit';
  id: number | null;
  habitId: number | null;
  title: string;
  categoryName: string | null;
  why: string | null;
  date: string;
  scheduledDate: string;
  isOverdue: boolean;
  plannedDurationMinutes: number | null;
  /** HH:mm of an appointment or timed habit; an appointment only moves after a confirmation. */
  timeOfDay: string | null;
  /** Last day a stored occurrence can be moved to; null for a forecast or todo. */
  moveUntil: string | null;
};
export type HistoryWeeklyTarget = {
  key: string;
  habitId: number;
  title: string;
  target: number;
  completed: number;
  remaining: number;
  fromDate: string;
  untilDate: string;
};
export type HistoryExternalEvent = {
  id: number;
  title: string;
  start: string;
  end: string;
};

/** One stretch of measured work, at its full length even across midnight. */
export type HistoryWorkLog = {
  id: number;
  title: string;
  startedAt: string;
  endedAt: string;
  minutes: number;
  source: WorkLogSource;
  todoId: number | null;
  occurrenceId: number | null;
  habitId: number | null;
  campaign: Campaign | null;
};

/** A campaign's part of a day's work; `campaign: null` is work without one. */
export type HistoryWorkShare = { campaign: Campaign | null; minutes: number };

/** The Logbuch of a day: what was measured, cut to the day. */
export type HistoryDayWork = {
  /** Overlapping stretches count once; see work-time.ts. */
  minutes: number;
  /** Day and week: the minutes by campaign, adding up to `minutes`. */
  campaigns?: HistoryWorkShare[];
  /** Day and week: every stretch that covers part of the day. */
  logs?: HistoryWorkLog[];
};

export type HistoryResponse = {
  today: string;
  timeZone: string;
  startDate: string;
  endDate: string;
  weeklyTargets?: HistoryWeeklyTarget[];
  /** Week view only; null when nothing was planned that week. */
  weekQuota?: WeekQuota | null;
  /** Week view without a filter; null when no category has a weekly target. */
  perfectWeek?: PerfectWeek | null;
  days: {
    date: string;
    items: HistoryItem[];
    planned?: HistoryPlannedItem[];
    /** Day and month view: read-only events of the read Google calendars. */
    external?: HistoryExternalEvent[];
    work: HistoryDayWork;
  }[];
};
