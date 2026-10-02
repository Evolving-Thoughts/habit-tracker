export type CreateTodoInput = {
  title: string;
  scheduledAt: string | null;
  plannedDurationMinutes: number | null;
  isFixed: boolean;
};

export type TodoResponse = {
  id: number;
  title: string;
  completed: boolean;
  completedAt: string | null;
  scheduledAt: string | null;
  plannedDurationMinutes: number | null;
  isFixed: boolean;
};
