import type { HierarchyTodo } from "../types/todo-hierarchy";
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
