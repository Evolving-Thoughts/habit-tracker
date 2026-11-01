export type GoalScope = {
  rootTodoId: number;
  doneCount: number;
  totalCount: number;
  doneMinutes: number;
  totalMinutes: number;
};

type ScopeTodo = {
  id: number;
  parentId?: number | null;
  completed: boolean;
  plannedDurationMinutes: number | null;
};

/** Sums every todo into its root. Both units are kept for the chart to pick. */
export function scopesByRoot(todos: ScopeTodo[]): GoalScope[] {
  const byId = new Map(todos.map((todo) => [todo.id, todo]));
  const roots = new Map<number, number>();
  const rootOf = (todo: ScopeTodo): number => {
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
    return root;
  };
  const scopes = new Map<number, GoalScope>();
  for (const todo of todos) {
    const rootTodoId = rootOf(todo);
    const scope = scopes.get(rootTodoId) ?? {
      rootTodoId,
      doneCount: 0,
      totalCount: 0,
      doneMinutes: 0,
      totalMinutes: 0,
    };
    const minutes = todo.plannedDurationMinutes ?? 0;
    scope.totalCount += 1;
    scope.totalMinutes += minutes;
    if (todo.completed) {
      scope.doneCount += 1;
      scope.doneMinutes += minutes;
    }
    scopes.set(rootTodoId, scope);
  }
  return [...scopes.values()];
}
