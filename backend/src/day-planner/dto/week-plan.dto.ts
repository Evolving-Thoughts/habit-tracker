import { IsString, Matches } from 'class-validator';

/** GET /day-planner/week?start=YYYY-MM-DD; `start` must be a Monday. */
export class WeekPlanQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly start!: string;
}

/** What every entry of the week plan shows. */
type WeekPlanEntryContext = {
  title: string;
  /** HH:mm of an appointment or timed habit; null when only the day is set. */
  timeOfDay: string | null;
  plannedDurationMinutes: number | null;
  /** The campaign the entry works towards; null for a loose entry. */
  campaign: { id: number; title: string } | null;
  /** Open and carried to today from an earlier day. */
  isOverdue: boolean;
};

export type WeekPlanTodoEntryDto = {
  type: 'todo';
  todoId: number;
  status: 'pending' | 'completed';
  /** The day it is planned for; earlier than its column when overdue. */
  scheduledDate: string;
} & WeekPlanEntryContext;

export type WeekPlanHabitEntryDto = {
  type: 'habit';
  habitId: number;
  /** The stored run; null for a run the schedule only forecasts. */
  occurrenceId: number | null;
  status: 'pending' | 'completed' | 'skipped';
} & WeekPlanEntryContext;

export type WeekPlanEntryDto = WeekPlanTodoEntryDto | WeekPlanHabitEntryDto;

export type WeekPlanDayDto = {
  date: string;
  /** Open entries in the order of the day, then resolved ones in that order. */
  entries: WeekPlanEntryDto[];
};

export type WeekPlanResponseDto = {
  /** The Monday the week starts on. */
  startDate: string;
  endDate: string;
  today: string;
  /** Monday to Sunday. */
  days: WeekPlanDayDto[];
};
