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
  categoryId: number | null;
  /** The daily's own reason. */
  why: string | null;
  /** The campaign it names (a top-level quest); null when it names none. */
  campaignId: number | null;
  /**
   * The campaign it works towards, for its chip: the named one, else the one
   * of the quest counting it today. Same shape as TodoResponse["campaign"].
   */
  campaign: {
    id: number;
    title: string;
    color: string | null;
    icon: string | null;
  } | null;
  /**
   * What it takes over from its campaign, else from the quest counting it
   * today, if it has none.
   * Same shape as InheritedWhy in ./todo; the contract-checked type files
   * stay free of imports.
   */
  inheritedWhy: { text: string; fromId: number; fromTitle: string } | null;
  isActive: boolean;
  plannedDurationMinutes: number | null;
  timeOfDay: string | null;
  timerOccurrenceId: number | null;
  timerDurationMinutes: number | null;
  currentSchedule: ScheduleVersionResponse | null;
  upcomingSchedule: ScheduleVersionResponse | null;
  /** Done runs in a row now and the longest series ever (Serie). */
  streak: { current: number; best: number; unit: "runs" | "weeks" };
};

export type UpdateHabitInput = {
  categoryId?: number | null;
  campaignId?: number | null;
  why?: string | null;
  plannedDurationMinutes?: number | null;
  timeOfDay?: string | null;
  title?: string;
  isActive?: boolean;
};

export type ChangeHabitScheduleInput = {
  effectiveFrom?: string;
  schedule: HabitScheduleRule;
};

export type CreateHabitInput = {
  categoryId?: number | null;
  campaignId?: number | null;
  why?: string | null;
  plannedDurationMinutes?: number | null;
  timeOfDay?: string;
  title: string;
  startDate?: string;
  schedule: HabitScheduleRule;
};

/** A Daily run as `GET /habit-occurrences/today` answers it (the fields read). */
export type HabitOccurrenceResponse = {
  id: number;
  habitId: number;
  scheduledDate: string;
  movedToDate: string | null;
  status: "pending" | "completed" | "skipped" | "cancelled";
};
