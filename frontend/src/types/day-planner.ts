export type TodoStatus = "pending" | "completed";

export type HabitOccurrenceStatus = "pending" | "completed" | "skipped";

export type HabitScheduleType = "interval" | "fixed_weekdays" | "weekly_target";

export type DayPlannerTodoItem = {
  type: "todo";
  todoId: number;
  title: string;
  categoryName?: string | null;
  status: TodoStatus;
  scheduledDate: string;
  scheduledAt: string | null;
  completedAt: string | null;
  plannedDurationMinutes: number | null;
  isFixed: boolean;
  isOverdue: boolean;
  timerEligible: boolean;
};

export type DayPlannerHabitItem = {
  type: "habit";
  occurrenceId: number;
  plannedDurationMinutes: number | null;
  timeOfDay?: string | null;
  habitId: number;
  title: string;
  categoryName?: string | null;
  status: HabitOccurrenceStatus;
  scheduledDate: string;
  moveUntil: string | null;
  scheduleType: HabitScheduleType;
  isOverdue: boolean;
  timerEligible: boolean;
};

export type DayPlannerItem = DayPlannerTodoItem | DayPlannerHabitItem;

export type DayPlannerResponse = {
  date: string;
  items: DayPlannerItem[];
  externalEvents?: {
    id: number;
    title: string;
    start: string;
    end: string;
  }[];
};
