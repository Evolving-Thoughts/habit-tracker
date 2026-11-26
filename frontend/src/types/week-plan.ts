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
  /** Open and from an earlier day: it stands in `overdue`, not on a day. */
  isOverdue: boolean;
};

export type WeekPlanTodoEntry = {
  type: "todo";
  todoId: number;
  status: "pending" | "completed";
  /** The day it is planned for; before today when overdue. */
  scheduledDate: string;
} & WeekPlanEntryContext;

export type WeekPlanHabitEntry = {
  type: "habit";
  habitId: number;
  /** The stored run; null for a run the schedule only forecasts. */
  occurrenceId: number | null;
  status: "pending" | "completed" | "skipped";
  /** Last day an open stored run may move to; null for a forecast or once resolved. */
  moveUntil: string | null;
  /** An open stored run due by today can be measured. */
  timerEligible: boolean;
  /** The daily's series: done runs in a row now, and the longest ever. */
  streak: { current: number; best: number; unit: "runs" | "weeks" };
  /** A run of the Daily carrying the running Monats-Challenge, in its month. */
  monthChallenge?: boolean;
} & WeekPlanEntryContext;

/**
 * A Google event on the day: read-only and always open; it keeps its time
 * but takes a place in the order like an appointment.
 */
export type WeekPlanEventEntry = {
  type: "event";
  /** The event's row (`externalEvents[].id` of Heute). */
  eventId: number;
  /** Ticked off in a day's list (only in the app, never in Google). */
  status: "pending" | "completed";
  start: string;
  end: string;
} & WeekPlanEntryContext;

export type WeekPlanEntry =
  | WeekPlanTodoEntry
  | WeekPlanHabitEntry
  | WeekPlanEventEntry;

/** An entry that is the person's own: a quest or a daily's run. */
export type WeekPlanOwnEntry = WeekPlanTodoEntry | WeekPlanHabitEntry;

export type WeekPlanDay = {
  date: string;
  /** Open entries in the order of the day, then resolved ones in that order. */
  entries: WeekPlanEntry[];
};

/** GET /day-planner/plan: the board's days and what was left behind. */
export type WeekPlanResponse = {
  /** The first day asked for. */
  startDate: string;
  endDate: string;
  today: string;
  /** One column per day from `startDate` to `endDate`. */
  days: WeekPlanDay[];
  /** Open from an earlier day (Liegen geblieben), earliest first. */
  overdue: WeekPlanEntry[];
};
