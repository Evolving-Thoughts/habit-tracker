import type {
  DayPlannerResponse,
  HabitOccurrenceStatus,
} from "../types/day-planner";
import type {
  ChangeHabitScheduleInput,
  CreateHabitInput,
  HabitResponse,
  UpdateHabitInput,
} from "../types/habit";
import type { CreateTodoInput, TodoResponse } from "../types/todo";

import { request } from "./http";

export function getToday(): Promise<DayPlannerResponse> {
  return request<DayPlannerResponse>("/day-planner/today");
}

export function getTodos(): Promise<TodoResponse[]> {
  return request<TodoResponse[]>("/todos");
}

export function createTodo(input: CreateTodoInput): Promise<TodoResponse> {
  return request<TodoResponse>("/todos", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTodo(
  todoId: number,
  input: Partial<CreateTodoInput>,
): Promise<TodoResponse> {
  return request<TodoResponse>(`/todos/${todoId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function updateTodoCompletion(
  todoId: number,
  completed: boolean,
): Promise<void> {
  return request<void>(`/todos/${todoId}`, {
    method: "PATCH",
    body: JSON.stringify({
      completed,
    }),
  });
}

export function updateTodoSchedule(
  todoId: number,
  input: {
    scheduledAt: string;
    isFixed: boolean;
  },
): Promise<TodoResponse> {
  return updateTodo(todoId, input);
}

export function updateOccurrenceStatus(
  occurrenceId: number,
  status: HabitOccurrenceStatus,
): Promise<void> {
  return request<void>(`/habit-occurrences/${occurrenceId}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
    }),
  });
}

export function getTodo(todoId: number): Promise<TodoResponse> {
  return request<TodoResponse>(`/todos/${todoId}`);
}

export function deleteTodo(todoId: number): Promise<void> {
  return request<void>(`/todos/${todoId}`, {
    method: "DELETE",
  });
}

export function createHabit(input: CreateHabitInput): Promise<HabitResponse> {
  return request<HabitResponse>("/habits", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getHabits(): Promise<HabitResponse[]> {
  return request<HabitResponse[]>("/habits");
}

export function getHabit(habitId: number): Promise<HabitResponse> {
  return request<HabitResponse>(`/habits/${habitId}`);
}

export function updateHabit(
  habitId: number,
  input: UpdateHabitInput,
): Promise<HabitResponse> {
  return request<HabitResponse>(`/habits/${habitId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function changeHabitSchedule(
  habitId: number,
  input: ChangeHabitScheduleInput,
): Promise<HabitResponse> {
  return request<HabitResponse>(`/habits/${habitId}/schedule-changes`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteHabit(habitId: number): Promise<void> {
  return request<void>(`/habits/${habitId}`, {
    method: "DELETE",
  });
}
