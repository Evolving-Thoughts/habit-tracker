import type {
  HabitGoalProgress,
  HierarchyTodo,
} from "../types/todo-hierarchy";
import {
  addDays,
  formatDateForGermanDisplay,
  getCurrentDateInTimeZone,
} from "./date";
import { hierarchyChildren, visibleHierarchy } from "./todo-hierarchy";

/**
 * The next quest of a campaign, among the open ones that can be worked on
 * (a Questreihe with open quests below gives way to those):
 * 1. planned for today, the earliest time first (untimed after the timed);
 * 2. left over from an earlier day, the earliest day first;
 * 3. planned for a later day, the nearest day (and time) first;
 * 4. without a day, in the order the campaign's page shows them.
 * Ties keep the page order. Null when nothing below the campaign is open.
 */
export function nextQuest(
  todos: HierarchyTodo[],
  campaignId: number,
  today: string = getCurrentDateInTimeZone(),
): HierarchyTodo | null {
  const children = hierarchyChildren(todos);
  const openBelow = (id: number) =>
    (children.get(id) ?? []).some((child) => !child.completed);
  const workable = visibleHierarchy(todos, new Set(), { under: campaignId })
    .map((row) => row.todo)
    .filter((todo) => !todo.completed && !openBelow(todo.id));
  const rank = (todo: HierarchyTodo): [number, string, string] => {
    const day = todo.scheduledDate;
    const time = todo.timeOfDay ?? "99:99";
    if (day === today) return [0, "", time];
    if (day !== null && day < today) return [1, day, time];
    if (day !== null) return [2, day, time];
    return [3, "", ""];
  };
  let best: HierarchyTodo | null = null;
  let bestRank: [number, string, string] | null = null;
  for (const todo of workable) {
    const current = rank(todo);
    if (
      !bestRank ||
      current[0] < bestRank[0] ||
      (current[0] === bestRank[0] &&
        (current[1] < bestRank[1] ||
          (current[1] === bestRank[1] && current[2] < bestRank[2])))
    ) {
      best = todo;
      bestRank = current;
    }
  }
  return best;
}

/**
 * A daily goal the quest links that still runs: not reached and its period
 * not over. It counts as open, like a quest that is not done.
 */
export function runningGoal(
  todo: Pick<HierarchyTodo, "habitGoal" | "periodEnd">,
  today: string = getCurrentDateInTimeZone(),
): HabitGoalProgress | null {
  const goal = todo.habitGoal ?? null;
  if (!goal || goal.reached) return null;
  if (todo.periodEnd !== null && todo.periodEnd < today) return null;
  return goal;
}

/** "Laufen gehen 9 von 24": a running goal in words. */
export function goalWords(goal: HabitGoalProgress): string {
  return `${goal.habitTitle} ${goal.completed} von ${goal.target}`;
}

/**
 * Nothing left open in a campaign, so "Abschließen" may stand as a visible
 * button (otherwise it waits in the "…"): it had quests or a daily goal,
 * every quest below is done and no goal of its own still runs.
 */
export function readyToComplete(
  todo: Pick<HierarchyTodo, "habitGoal" | "periodEnd" | "progress">,
  today: string = getCurrentDateInTimeZone(),
): boolean {
  const { todoCount, doneCount } = todo.progress;
  return (
    (todoCount > 0 || Boolean(todo.habitGoal)) &&
    doneCount === todoCount &&
    runningGoal(todo, today) === null
  );
}

/** "heute", "morgen" or the short date ("27.11."); null without a day. */
export function questDay(
  scheduledDate: string | null,
  today: string,
): string | null {
  if (!scheduledDate) return null;
  if (scheduledDate === today) return "heute";
  if (scheduledDate === addDays(today, 1)) return "morgen";
  return formatDateForGermanDisplay(scheduledDate).slice(0, 6);
}
