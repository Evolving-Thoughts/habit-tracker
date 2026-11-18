import type { HierarchyTodo, TodoProgress } from "../types/todo-hierarchy";

/*
 * Progress is the server's (`todo-hierarchy.ts` in the backend): the quests
 * below a quest, never the quest itself. The frontend only shows it.
 */

/** Only a quest with quests below it has progress to show. */
export function hasProgress(progress: TodoProgress): boolean {
  return progress.todoCount > 0;
}

/** "1/3", or "30/120 Min." when every quest below has a duration. */
export function progressText(progress: TodoProgress): string {
  return progress.mode === "duration"
    ? `${progress.completed}/${progress.total} Min.`
    : `${progress.completed}/${progress.total}`;
}

/** The same in words for screen readers: "1 von 3 Quests darunter erledigt". */
export function progressWords(progress: TodoProgress): string {
  return progress.mode === "duration"
    ? `${progress.completed} von ${progress.total} Minuten darunter erledigt`
    : `${progress.completed} von ${progress.total} Quests darunter erledigt`;
}

/** Quests below that are still open. */
export function openBelow(progress: TodoProgress): number {
  return progress.todoCount - progress.doneCount;
}

export function hierarchyChildren(todos: HierarchyTodo[]) {
  const groups = new Map<number | null, HierarchyTodo[]>();
  for (const todo of todos) {
    const group = groups.get(todo.parentId) ?? [];
    group.push(todo);
    groups.set(todo.parentId, group);
  }
  return groups;
}
export function visibleHierarchy(
  todos: HierarchyTodo[],
  collapsed: Set<number>,
) {
  const groups = hierarchyChildren(todos);
  const stack = (groups.get(null) ?? [])
    .slice()
    .reverse()
    .map((todo) => ({ todo, depth: 0 }));
  const rows: { todo: HierarchyTodo; depth: number }[] = [],
    seen = new Set<number>();
  while (stack.length) {
    const row = stack.pop()!;
    if (seen.has(row.todo.id)) throw Error("Ungültige Hierarchie");
    seen.add(row.todo.id);
    rows.push(row);
    if (!collapsed.has(row.todo.id))
      for (const todo of (groups.get(row.todo.id) ?? []).slice().reverse())
        stack.push({ todo, depth: row.depth + 1 });
  }
  return rows;
}
export function descendantIds(todos: HierarchyTodo[], id: number) {
  const groups = hierarchyChildren(todos),
    stack = [id],
    seen = new Set<number>();
  while (stack.length) {
    const next = stack.pop()!;
    if (seen.has(next)) continue;
    seen.add(next);
    for (const child of groups.get(next) ?? []) stack.push(child.id);
  }
  return seen;
}
