import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, Max, Min } from 'class-validator';
import type { Streak } from '../../habits/streaks';
import type { Campaign } from '../../todos/todo-ancestry';
import { MAX_PLAN_DAYS } from '../week-plan';

/** GET /day-planner/plan?from=YYYY-MM-DD&days=N: `days` columns from `from`. */
export class PlanQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly from!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PLAN_DAYS)
  readonly days!: number;
}

/** What every entry of the week plan shows. */
type WeekPlanEntryContext = {
  title: string;
  /** HH:mm of an appointment or timed habit; null when only the day is set. */
  timeOfDay: string | null;
  plannedDurationMinutes: number | null;
  /** The campaign the entry works towards; null for a loose entry. */
  campaign: Campaign | null;
  /** Open and from an earlier day: it stands in `overdue`, not on a day. */
  isOverdue: boolean;
};

export type WeekPlanTodoEntryDto = {
  type: 'todo';
  todoId: number;
  status: 'pending' | 'completed';
  /** The day it is planned for; before today when overdue. */
  scheduledDate: string;
} & WeekPlanEntryContext;

export type WeekPlanHabitEntryDto = {
  type: 'habit';
  habitId: number;
  /** The stored run; null for a run the schedule only forecasts. */
  occurrenceId: number | null;
  status: 'pending' | 'completed' | 'skipped';
  /** Last day an open stored run may move to; null for a forecast or once resolved. */
  moveUntil: string | null;
  /** An open stored run due by today can be measured. */
  timerEligible: boolean;
  /** The daily's series (see habits/streaks.ts). */
  streak: Streak;
  /** A run of the Daily carrying the running Monats-Challenge, in its month. */
  monthChallenge: boolean;
} & WeekPlanEntryContext;

export type WeekPlanEntryDto = WeekPlanTodoEntryDto | WeekPlanHabitEntryDto;

export type WeekPlanDayDto = {
  date: string;
  /** Open entries in the order of the day, then resolved ones in that order. */
  entries: WeekPlanEntryDto[];
};

export type WeekPlanResponseDto = {
  /** The first day asked for. */
  startDate: string;
  endDate: string;
  today: string;
  /** One column per day from `startDate` to `endDate`. */
  days: WeekPlanDayDto[];
  /**
   * What is open from an earlier day (Liegen geblieben), earliest first,
   * whatever days were asked for: the same quests and runs as Heute's
   * Nachholen.
   */
  overdue: WeekPlanEntryDto[];
};
