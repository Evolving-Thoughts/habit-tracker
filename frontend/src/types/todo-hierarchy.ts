import type { TodoResponse } from "./todo";
export type TodoProgress = {
  mode: "count" | "duration";
  completed: number;
  total: number;
  percentage: number;
  knownDurationMinutes: number;
  todoCount: number;
};
export type HabitGoalProgress = {
  habitId: number;
  habitTitle: string;
  target: number;
  completed: number;
  reached: boolean;
};
export type HierarchyTodo = TodoResponse & {
  progress: TodoProgress;
  habitGoal?: HabitGoalProgress | null;
};
export type BurnupPoint = {
  date: string;
  doneCount: number;
  totalCount: number;
  doneMinutes: number;
  totalMinutes: number;
};
export type DeletionPreview = {
  confirmationToken: string;
  todos: {
    id: number;
    title: string;
    parentId: number | null;
    completed: boolean;
  }[];
  timers: {
    id: string;
    todoId: number;
    title: string;
    state: "running" | "paused" | "finished" | "stopped";
  }[];
};
