export type TodoStatus = "pending" | "completed";

export type HabitOccurrenceStatus = "pending" | "completed" | "skipped";

export type HabitScheduleType = "interval" | "fixed_weekdays" | "weekly_target";

export type DayPlannerTodoItem = {
  type: "todo";
  todoId: number;
  title: string;
  status: TodoStatus;
  scheduledDate: string;
  scheduledAt: string | null;
  completedAt: string | null;
  plannedDurationMinutes: number | null;
  isFixed: boolean;
  isOverdue: boolean;
};

export type DayPlannerHabitItem = {
  type: "habit";
  occurrenceId: number;
  plannedDurationMinutes: number | null;
  habitId: number;
  title: string;
  status: HabitOccurrenceStatus;
  scheduledDate: string;
  scheduleType: HabitScheduleType;
  isOverdue: boolean;
};

export type DayPlannerItem = DayPlannerTodoItem | DayPlannerHabitItem;

export type DayPlannerResponse = {
  date: string;
  items: DayPlannerItem[];
};
