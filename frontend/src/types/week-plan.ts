type WeekPlanEntryContext = {
  title: string;
  /** HH:mm of an appointment or timed daily; null when only the day is set. */
  timeOfDay: string | null;
  plannedDurationMinutes: number | null;
  /** The campaign the entry works towards; null for a loose entry. */
  /** Colour and icon are keys from `campaign.ts`. */
  campaign: {
    id: number;
    title: string;
    color: string | null;
    icon: string | null;
  } | null;
  /** Open and carried to today from an earlier day. */
  isOverdue: boolean;
};

export type WeekPlanTodoEntry = {
  type: "todo";
  todoId: number;
  status: "pending" | "completed";
  /** The day it is planned for; earlier than its column when overdue. */
  scheduledDate: string;
} & WeekPlanEntryContext;

export type WeekPlanHabitEntry = {
  type: "habit";
  habitId: number;
  /** The stored run; null for a run the schedule only forecasts. */
  occurrenceId: number | null;
  status: "pending" | "completed" | "skipped";
} & WeekPlanEntryContext;

export type WeekPlanEntry = WeekPlanTodoEntry | WeekPlanHabitEntry;

export type WeekPlanDay = {
  date: string;
  /** Open entries in the order of the day, then resolved ones in that order. */
  entries: WeekPlanEntry[];
};

export type WeekPlanResponse = {
  /** The Monday the week starts on. */
  startDate: string;
  endDate: string;
  today: string;
  days: WeekPlanDay[];
};
