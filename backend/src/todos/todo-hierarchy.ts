import { BadRequestException } from '@nestjs/common';

export interface HierarchyTodo {
  id: number;
  parentId?: number | null;
  completed: boolean;
  plannedDurationMinutes: number | null;
}
export interface TodoProgress {
  mode: 'count' | 'duration';
  completed: number;
  total: number;
  percentage: number;
  knownDurationMinutes: number;
  todoCount: number;
}

/** Iterative postorder: O(n) time/space, no recursion and no depth cap. */
export function hierarchyProgress(
  todos: HierarchyTodo[],
): Map<number, TodoProgress> {
  const byId = new Map(todos.map((t) => [t.id, t]));
  const parents = new Map<number, number>();
  const pending = new Map<number, number>();
  const totals = new Map(
    todos.map((t) => [
      t.id,
      {
        count: 1,
        done: Number(t.completed),
        known: t.plannedDurationMinutes ?? 0,
        doneDuration: t.completed ? (t.plannedDurationMinutes ?? 0) : 0,
        missing: Number(t.plannedDurationMinutes == null),
      },
    ]),
  );
  for (const t of todos) pending.set(t.id, 0);
  for (const t of todos) {
    if (t.parentId != null) {
      if (!byId.has(t.parentId))
        throw new BadRequestException('Invalid todo hierarchy');
      parents.set(t.id, t.parentId);
      pending.set(t.parentId, pending.get(t.parentId)! + 1);
    }
  }
  const queue = todos.filter((t) => pending.get(t.id) === 0).map((t) => t.id);
  const result = new Map<number, TodoProgress>();
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i],
      a = totals.get(id)!;
    const duration = a.missing === 0;
    const completed = duration ? a.doneDuration : a.done;
    const total = duration ? a.known : a.count;
    result.set(id, {
      mode: duration ? 'duration' : 'count',
      completed,
      total,
      percentage: total > 0 ? (completed / total) * 100 : 0,
      knownDurationMinutes: a.known,
      todoCount: a.count,
    });
    const parent = parents.get(id);
    if (parent !== undefined) {
      const p = totals.get(parent)!;
      p.count += a.count;
      p.done += a.done;
      p.known += a.known;
      p.doneDuration += a.doneDuration;
      p.missing += a.missing;
      pending.set(parent, pending.get(parent)! - 1);
      if (pending.get(parent) === 0) queue.push(parent);
    }
  }
  if (result.size !== todos.length)
    throw new BadRequestException('Invalid todo hierarchy');
  return result;
}

/** Walk target ancestors to reject a cycle, without recursive calls. */
export function validateParent(
  todos: HierarchyTodo[],
  id: number,
  parentId: number | null,
): void {
  const byId = new Map(todos.map((t) => [t.id, t]));
  const seen = new Set<number>([id]);
  let current = parentId;
  while (current !== null) {
    if (seen.has(current))
      throw new BadRequestException(
        'A todo cannot be moved below itself or a descendant',
      );
    seen.add(current);
    const parent = byId.get(current);
    if (!parent) throw new BadRequestException('Parent is unavailable');
    current = parent.parentId ?? null;
  }
}
