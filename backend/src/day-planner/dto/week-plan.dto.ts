import { Type } from 'class-transformer';
import { IsInt, IsString, Max, Min } from 'class-validator';
import { IsDay } from '../../common/validation/field-rules';
import type { Streak } from '../../habits/streaks';
import type { Campaign } from '../../todos/todo-ancestry';
import { MAX_PLAN_DAYS } from '../week-plan';

/** GET /day-planner/plan?from=YYYY-MM-DD&days=N: `days` columns from `from`. */
export class PlanQueryDto {
  @IsString()
  @IsDay()
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

/**
 * An event of the person's Google calendars on this day: read-only, it
 * keeps its time, but takes a place in the order of the day like an
 * appointment (`PUT /day-planner/order` with `{ type: 'event', id }`).
 */
export type WeekPlanEventEntryDto = {
  type: 'event';
  /** `externalEvents[].id` of Heute: the event's row, kept across syncs. */
  eventId: number;
  /** Ticked off in a day's list (only in the app, never in Google). */
  status: 'pending' | 'completed';
  start: string;
  end: string;
} & WeekPlanEntryContext;

export type WeekPlanEntryDto =
  WeekPlanTodoEntryDto | WeekPlanHabitEntryDto | WeekPlanEventEntryDto;

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
