import { IsIn, IsOptional, IsString } from 'class-validator';
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
  status: 'completed' | 'skipped';
  date: string;
  scheduledDate: string | null;
  resolvedAt: string | null;
  plannedDurationMinutes: number | null;
  deleted: boolean;
};
export type HistoryPlannedItem = {
  key: string;
  type: 'todo' | 'habit';
  id: number | null;
  habitId: number | null;
  title: string;
  date: string;
  scheduledDate: string;
  isOverdue: boolean;
  plannedDurationMinutes: number | null;
  /** Fixed todos only move after a confirmation. */
  isFixed: boolean;
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
    /** Month view: read-only events of the main Google calendar. */
    external?: HistoryExternalEvent[];
  }[];
};
