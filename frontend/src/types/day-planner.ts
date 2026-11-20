export type TodoStatus = "pending" | "completed";

export type HabitOccurrenceStatus = "pending" | "completed" | "skipped";

export type HabitScheduleType = "interval" | "fixed_weekdays" | "weekly_target";

/** The goal an item serves: a todo's parent, or the goal counting a habit. */
export type DayPlannerGoal = {
  title: string;
  completed: number | null;
  target: number | null;
  periodEnd: string | null;
};

type DayPlannerItemContext = {
  why: string | null;
  goal: DayPlannerGoal | null;
  /** The campaign the item works towards; null for a loose item. */
  /** Colour and icon are keys from `campaign.ts`. */
  campaign: {
    id: number;
    title: string;
    color: string | null;
    icon: string | null;
  } | null;
  workedMinutes: number;
};

export type DayPlannerTodoItem = {
  type: "todo";
  todoId: number;
  title: string;
  categoryName: string | null;
  /** A colour key from `campaign.ts`; null while the name picks one. */
  categoryColor: string | null;
  status: TodoStatus;
  scheduledDate: string;
  /** HH:mm of an appointment; null for a quest that only has its day. */
  timeOfDay: string | null;
  completedAt: string | null;
  plannedDurationMinutes: number | null;
  isOverdue: boolean;
  timerEligible: boolean;
} & DayPlannerItemContext;

export type DayPlannerHabitItem = {
  type: "habit";
  occurrenceId: number;
  plannedDurationMinutes: number | null;
  timeOfDay: string | null;
  habitId: number;
  title: string;
  categoryName: string | null;
  /** A colour key from `campaign.ts`; null while the name picks one. */
  categoryColor: string | null;
  status: HabitOccurrenceStatus | "cancelled";
  scheduledDate: string;
  moveUntil: string | null;
  scheduleType: HabitScheduleType;
  isOverdue: boolean;
  timerEligible: boolean;
} & DayPlannerItemContext;

export type DayPlannerItem = DayPlannerTodoItem | DayPlannerHabitItem;

export type DayPlannerResponse = {
  date: string;
  /** Appointments and timed dailies by clock, then the order of the day. */
  items: DayPlannerItem[];
  externalEvents: {
    id: number;
    title: string;
    start: string;
    end: string;
  }[];
  workedMinutes: number;
  /** Quest minutes today and this week, against the overall goal. */
  questHours: {
    todayMinutes: number;
    weekMinutes: number;
    weeklyTargetMinutes: number | null;
  };
};
