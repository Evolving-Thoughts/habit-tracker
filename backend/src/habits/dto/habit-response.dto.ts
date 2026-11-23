import type { Campaign } from '../../todos/todo-ancestry';
import type { InheritedWhy } from '../../todos/todo-hierarchy';
import type { Streak } from '../streaks';
import type { FocusBlockOverride } from '../../focus-blocks/focus-block-rules';
import { HabitScheduleType } from '../enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../enums/missed-occurrence-policy.enum';
import { Weekday } from '../enums/weekday.enum';

export type ScheduleRuleResponse =
  | {
      type: HabitScheduleType.INTERVAL;
      intervalDays: number;
      missedOccurrencePolicy: MissedOccurrencePolicy;
    }
  | {
      type: HabitScheduleType.FIXED_WEEKDAYS;
      weekdays: Weekday[];
      missedOccurrencePolicy: MissedOccurrencePolicy;
    }
  | {
      type: HabitScheduleType.WEEKLY_TARGET;
      weeklyTarget: number;
    };

export type ScheduleVersionResponse = {
  id: number;
  effectiveFrom: string;
  effectiveAt: string;
  endsAt: string | null;
  cancelledAt: string | null;
  firstDueDate: string | null;
  schedule: ScheduleRuleResponse;
};

export type HabitResponseDto = {
  plannedDurationMinutes: number | null;
  timeOfDay: string | null;
  /** Fokus-Sperre: the default rule, always or never. */
  focusBlock: FocusBlockOverride;
  timerOccurrenceId: number | null;
  timerDurationMinutes: number | null;
  id: number;
  title: string;
  categoryId: number | null;
  /** The habit's own reason. */
  why: string | null;
  /** The campaign it names (a top-level todo); null when it names none. */
  campaignId: number | null;
  /**
   * The campaign it works towards, for its chip: the named one, else the one
   * of the goal counting it today.
   */
  campaign: Campaign | null;
  /** What it takes over (named campaign, else counting goal) if it has none. */
  inheritedWhy: InheritedWhy | null;
  isActive: boolean;
  currentSchedule: ScheduleVersionResponse | null;
  upcomingSchedule: ScheduleVersionResponse | null;
  /** Done runs in a row and the longest such series (see streaks.ts). */
  streak: Streak;
  /** It carries this month's running Monats-Challenge (the rows' marker). */
  monthChallenge: boolean;
};
