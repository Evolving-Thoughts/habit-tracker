export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type MissedOccurrencePolicy = "carry_over" | "skip";

// Each rule contains only the fields that its schedule type accepts.
export type HabitScheduleRule =
  | {
      type: "interval";
      intervalDays: number;
      missedOccurrencePolicy: MissedOccurrencePolicy;
    }
  | {
      type: "fixed_weekdays";
      weekdays: Weekday[];
      missedOccurrencePolicy: MissedOccurrencePolicy;
    }
  | { type: "weekly_target"; weeklyTarget: number };

export type ScheduleVersionResponse = {
  id: number;
  effectiveFrom: string;
  effectiveAt: string;
  endsAt: string | null;
  cancelledAt: string | null;
  firstDueDate: string | null;
  schedule: HabitScheduleRule;
};

export type HabitResponse = {
  id: number;
  title: string;
  isActive: boolean;
  plannedDurationMinutes: number | null;
  timerOccurrenceId: number | null;
  timerDurationMinutes: number | null;
  currentSchedule: ScheduleVersionResponse | null;
  upcomingSchedule: ScheduleVersionResponse | null;
};

export type UpdateHabitInput = {
  plannedDurationMinutes?: number | null;
  title?: string;
  isActive?: boolean;
};

export type ChangeHabitScheduleInput = {
  effectiveFrom?: string;
  schedule: HabitScheduleRule;
};

export type CreateHabitInput = {
  plannedDurationMinutes?: number | null;
  title: string;
  startDate?: string;
  schedule: HabitScheduleRule;
};
