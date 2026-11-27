import type { OrderRef } from "../utils/day-order";
import type {
  DayPlannerResponse,
  HabitOccurrenceStatus,
} from "../types/day-planner";
import type {
  ChangeHabitScheduleInput,
  CreateHabitInput,
  HabitOccurrenceResponse,
  HabitResponse,
  UpdateHabitInput,
} from "../types/habit";
import type {
  CreateTodoInput,
  TodoResponse,
  UpdateTodoInput,
} from "../types/todo";
import type { WeekPlanResponse } from "../types/week-plan";

import { request } from "./http";

export function getToday(): Promise<DayPlannerResponse> {
  return request<DayPlannerResponse>("/day-planner/today");
}

/** `days` days from `from` as a board of columns, and what is overdue. */
export function getPlan(
  from: string,
  days: number,
  signal?: AbortSignal,
): Promise<WeekPlanResponse> {
  const params = new URLSearchParams({ from, days: String(days) });
  return request<WeekPlanResponse>(`/day-planner/plan?${params}`, { signal });
}

/** Stores the order any day was sorted into; habits go by their occurrence. */
export function reorderDay(items: OrderRef[]): Promise<void> {
  return request<void>("/day-planner/order", {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
}

/** Ticks a Google event off in the app or opens it again; Google stays as it is. */
export function setEventDone(eventId: number, done: boolean): Promise<void> {
  return request<void>(`/day-planner/events/${eventId}/done`, {
    method: "PUT",
    body: JSON.stringify({ done }),
  });
}

export function getTodos(): Promise<TodoResponse[]> {
  return request<TodoResponse[]>("/todos");
}

/** Open todos without a day (the Questlog), filtered by the server's todo agenda. */
export function getBacklogTodos(): Promise<TodoResponse[]> {
  return request<TodoResponse[]>("/todos/backlog");
}

/** Stores the Questlog's order: these quests first, the rest after them. */
export function reorderBacklog(ids: number[]): Promise<void> {
  return request<void>("/todos/backlog/order", {
    method: "PUT",
    body: JSON.stringify({ ids }),
  });
}

export function createTodo(input: CreateTodoInput): Promise<TodoResponse> {
  return request<TodoResponse>("/todos", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTodo(
  todoId: number,
  input: UpdateTodoInput,
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

/**
 * Work on a quest stops for now (the campaign board's "Zurückstellen"):
 * it leaves "In Arbeit", blocked or not.
 */
export function setAsideTodo(
  todoId: number,
  blocked: boolean,
): Promise<TodoResponse> {
  return request<TodoResponse>(`/todos/${todoId}/set-aside`, {
    method: "POST",
    body: JSON.stringify({ blocked }),
  });
}

/** Takes an open quest into "In Arbeit" by hand; no stopwatch starts. */
export function startWorkOnTodo(todoId: number): Promise<TodoResponse> {
  return request<TodoResponse>(`/todos/${todoId}/start-work`, {
    method: "POST",
    body: "{}",
  });
}

/** "Als geblockt markieren" and "Blocker aufheben" on the campaign board. */
export function setTodoBlocked(
  todoId: number,
  blocked: boolean,
): Promise<TodoResponse> {
  return updateTodo(todoId, { blocked });
}

export function rescheduleTodo(
  todoId: number,
  date: string,
  confirmFixed: boolean,
): Promise<TodoResponse> {
  return request<TodoResponse>(`/todos/${todoId}/reschedule`, {
    method: "POST",
    body: JSON.stringify({ date, confirmFixed }),
  });
}

export function rescheduleOccurrence(
  occurrenceId: number,
  date: string,
): Promise<void> {
  return request<void>(`/habit-occurrences/${occurrenceId}/reschedule`, {
    method: "POST",
    body: JSON.stringify({ date }),
  });
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

/** Today's Daily runs; the server first creates the ones that are due. */
export function getTodaysOccurrences(): Promise<HabitOccurrenceResponse[]> {
  return request<HabitOccurrenceResponse[]>("/habit-occurrences/today");
}

/**
 * The stored run of a Daily that is open today. A view that only knows the
 * forecast (the Kalender reads without writing) asks for it right before
 * completing, so a ring there runs the same occurrence path as on Heute.
 */
export async function openRunToday(
  habitId: number,
  scheduledDate?: string,
): Promise<number | null> {
  const open = (await getTodaysOccurrences()).filter(
    (run) => run.habitId === habitId && run.status === "pending",
  );
  const run =
    open.find((entry) => entry.scheduledDate === scheduledDate) ?? open[0];
  return run?.id ?? null;
}

export function getTodo(todoId: number): Promise<TodoResponse> {
  return request<TodoResponse>(`/todos/${todoId}`);
}

/** Deletes a todo and its subtree; needs the token of its deletion preview. */
export function deleteTodo(
  todoId: number,
  confirmationToken: string,
): Promise<void> {
  return request<void>(`/todos/${todoId}`, {
    method: "DELETE",
    body: JSON.stringify({ confirmationToken }),
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
