import type { TodoResponse } from "./todo";
export type TodoProgress = {
  mode: "count" | "duration";
  completed: number;
  total: number;
  percentage: number;
  knownDurationMinutes: number;
  todoCount: number;
};
export type HierarchyTodo = TodoResponse & { progress: TodoProgress };
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
