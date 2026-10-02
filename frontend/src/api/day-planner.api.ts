import type {
  DayPlannerResponse,
  HabitOccurrenceStatus,
} from "../types/day-planner";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getToday(): Promise<DayPlannerResponse> {
  return request<DayPlannerResponse>("/day-planner/today");
}

export function updateTodoCompletion(
  todoId: number,
  completed: boolean,
): Promise<void> {
  return request(`/todos/${todoId}`, {
    method: "PATCH",
    body: JSON.stringify({
      completed,
    }),
  });
}

export function updateOccurrenceStatus(
  occurrenceId: number,
  status: HabitOccurrenceStatus,
): Promise<void> {
  return request(`/habit-occurrences/${occurrenceId}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
    }),
  });
}
