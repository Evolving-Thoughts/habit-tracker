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
  workedMinutes: number;
};

export type DayPlannerTodoItem = {
  type: "todo";
  todoId: number;
  title: string;
  categoryName: string | null;
  status: TodoStatus;
  scheduledDate: string;
  scheduledAt: string | null;
  completedAt: string | null;
  plannedDurationMinutes: number | null;
  isFixed: boolean;
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
  items: DayPlannerItem[];
  externalEvents: {
    id: number;
    title: string;
    start: string;
    end: string;
  }[];
  workedMinutes: number;
};
