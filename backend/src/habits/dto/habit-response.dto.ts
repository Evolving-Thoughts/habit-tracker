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
  timerOccurrenceId: number | null;
  timerDurationMinutes: number | null;
  id: number;
  title: string;
  isActive: boolean;
  currentSchedule: ScheduleVersionResponse | null;
  upcomingSchedule: ScheduleVersionResponse | null;
};
