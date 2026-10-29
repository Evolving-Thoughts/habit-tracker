export type CreateTodoInput = {
  parentId?: number | null;
  title: string;
  scheduledAt: string | null;
  plannedDurationMinutes: number | null;
  isFixed: boolean;
};

export type TodoResponse = {
  id: number;
  /** Parent in the todo hierarchy; null for a root. */
  parentId: number | null;
  title: string;
  completed: boolean;
  completedAt: string | null;
  scheduledAt: string | null;
  plannedDurationMinutes: number | null;
  isFixed: boolean;
  /** Server-side timer-target rule: may a timer run for this todo? */
  timerEligible: boolean;
};
