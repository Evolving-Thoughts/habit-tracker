import type { HabitScheduleType } from "./day-planner";

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type MissedOccurrencePolicy = "carry_over" | "skip";

export type HabitResponse = {
  id: number;
  title: string;
  scheduleType: HabitScheduleType;
  startDate: string;
  intervalDays: number | null;
  weekdays: Weekday[] | null;
  weeklyTarget: number | null;
  missedOccurrencePolicy: MissedOccurrencePolicy;
  isActive: boolean;
};

export type UpdateHabitInput = {
  title?: string;
  scheduleType?: HabitScheduleType;
  intervalDays?: number | null;
  weekdays?: Weekday[] | null;
  weeklyTarget?: number | null;
  isActive?: boolean;
  missedOccurrencePolicy?: MissedOccurrencePolicy;
};
