import { TODO_FIELDS } from "../types/fixtures";
import type { HierarchyTodo } from "../types/todo-hierarchy";

/**
 * A quest as `GET /todos/hierarchy` answers it, for specs. A top-level quest
 * with a colour (or one other quests name as parent) counts as a campaign;
 * pass `campaign` where a view reads it.
 */
export function hierarchyTodo(
  overrides: Partial<HierarchyTodo> & { id: number; title: string },
): HierarchyTodo {
  return {
    ...TODO_FIELDS,
    parentId: null,
    completed: false,
    completedAt: null,
    scheduledDate: null,
    timeOfDay: null,
    plannedDurationMinutes: null,
    timerEligible: true,
    progress: {
      mode: "count",
      completed: 0,
      total: 0,
      percentage: 0,
      knownDurationMinutes: 0,
      todoCount: 0,
      doneCount: 0,
    },
    ...overrides,
  };
}
