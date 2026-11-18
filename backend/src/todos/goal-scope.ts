export type GoalScope = {
  rootTodoId: number;
  doneCount: number;
  totalCount: number;
  doneMinutes: number;
  totalMinutes: number;
};

type TreeTodo = { id: number; parentId?: number | null };

type ScopeTodo = TreeTodo & {
  completed: boolean;
  plannedDurationMinutes: number | null;
};

/**
 * The root of every todo: the topmost one above it in the list. A todo whose
 * parent is missing is its own root; a cycle stops instead of looping.
 */
export function rootIds(todos: TreeTodo[]): Map<number, number> {
  const byId = new Map(todos.map((todo) => [todo.id, todo]));
  const roots = new Map<number, number>();
  for (const todo of todos) {
    const path: number[] = [];
    let current = todo;
    while (!roots.has(current.id)) {
      path.push(current.id);
      const parent =
        current.parentId == null ? undefined : byId.get(current.parentId);
      if (!parent || path.includes(parent.id)) break;
      current = parent;
    }
    const root = roots.get(current.id) ?? current.id;
    for (const id of path) roots.set(id, root);
  }
  return roots;
}

/**
 * Sums the todos below every root into it: the progress of a campaign is
 * the quests below it, never the campaign itself (like the hierarchy's
 * progress in `todo-hierarchy.ts`). Every counted root has a scope, a lone
 * one with nothing below it all zeros, so its stored row stays current when
 * its last quest goes. Both units are kept for the chart to pick.
 * `counts` leaves todos out of the sums without cutting the tree, so a todo
 * still finds its root through a parent that does not count.
 */
export function scopesByRoot<T extends ScopeTodo>(
  todos: T[],
  counts: (todo: T) => boolean = () => true,
): GoalScope[] {
  const roots = rootIds(todos);
  const scopes = new Map<number, GoalScope>();
  const scopeOf = (rootTodoId: number): GoalScope => {
    let scope = scopes.get(rootTodoId);
    if (!scope) {
      scope = {
        rootTodoId,
        doneCount: 0,
        totalCount: 0,
        doneMinutes: 0,
        totalMinutes: 0,
      };
      scopes.set(rootTodoId, scope);
    }
    return scope;
  };
  for (const todo of todos) {
    if (!counts(todo)) continue;
    const rootTodoId = roots.get(todo.id)!;
    const scope = scopeOf(rootTodoId);
    if (rootTodoId === todo.id) continue;
    const minutes = todo.plannedDurationMinutes ?? 0;
    scope.totalCount += 1;
    scope.totalMinutes += minutes;
    if (todo.completed) {
      scope.doneCount += 1;
      scope.doneMinutes += minutes;
    }
  }
  return [...scopes.values()];
}
