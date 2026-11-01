export type CreateTodoInput = {
  parentId?: number | null;
  categoryId?: number | null;
  why?: string | null;
  title: string;
  scheduledAt: string | null;
  plannedDurationMinutes: number | null;
  isFixed: boolean;
};

export type TodoGoalInput = {
  periodStart?: string | null;
  periodEnd?: string | null;
  goalHabitId?: number | null;
  goalTarget?: number | null;
};

export type UpdateTodoInput = Partial<CreateTodoInput> & TodoGoalInput;

export type TodoResponse = Required<TodoGoalInput> & {
  id: number;
  /** Parent in the todo hierarchy; null for a root. */
  parentId: number | null;
  categoryId: number | null;
  why: string | null;
  title: string;
  completed: boolean;
  completedAt: string | null;
  scheduledAt: string | null;
  plannedDurationMinutes: number | null;
  isFixed: boolean;
  /** Server-side timer-target rule: may a timer run for this todo? */
  timerEligible: boolean;
};
