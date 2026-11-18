import type { TodoResponse } from "../types/todo";
import { buildTodoInput } from "../utils/todo-input";
import { updateTodo } from "./day-planner.api";

/**
 * Gives a quest from the Questlog its day, the way the Questlog's editor
 * saves it (PATCH /todos/:id). Rescheduling refuses quests without a day,
 * so the Questlog, its shortcuts and the Plan's Questlog column all plan
 * through here.
 */
export function planQuest(
  todo: Pick<TodoResponse, "id" | "title" | "plannedDurationMinutes">,
  date: string,
): Promise<TodoResponse> {
  return updateTodo(
    todo.id,
    buildTodoInput({
      title: todo.title,
      date,
      time: "",
      duration: todo.plannedDurationMinutes ?? "",
    }),
  );
}
