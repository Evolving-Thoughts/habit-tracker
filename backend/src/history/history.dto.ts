import { IsIn, IsOptional, IsString } from 'class-validator';
export class HistoryQueryDto {
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsIn(['day', 'week']) view?: 'day' | 'week';
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
export type HistoryResponse = {
  today: string;
  timeZone: string;
  startDate: string;
  endDate: string;
  weeklyTargets?: HistoryWeeklyTarget[];
  days: {
    date: string;
    items: HistoryItem[];
    planned?: HistoryPlannedItem[];
  }[];
};
