/**
 * Todo hierarchy: every rule about the tree, over an in-memory snapshot of
 * todos (all of a user's todos, an ancestor chain, or a subtree). No I/O and
 * no framework exceptions; the service maps the two error types to HTTP.
 *
 * A parent's own completion is independent of its subtree: nothing here
 * completes or reopens other nodes. Progress shows the subtree state.
 */
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

/** The requested placement is invalid (client error). */
export class InvalidPlacementError extends Error {}
/** Stored data contains a cycle (server-side integrity problem). */
export class CorruptHierarchyError extends Error {
  constructor() {
    super('Invalid todo hierarchy');
  }
}

export class TodoTree<T extends HierarchyTodo> {
  private constructor(
    private readonly byId: Map<number, T>,
    private readonly children: Map<number, T[]>,
    /** Nodes without a parent in the snapshot, in id order. */
    readonly roots: T[],
  ) {}

  /**
   * Builds the tree. A node whose parent is not in the snapshot counts as a
   * root, so a partial snapshot (or an orphan) never breaks reading.
   * Throws CorruptHierarchyError if the stored parents form a cycle.
   */
  static of<T extends HierarchyTodo>(todos: T[]): TodoTree<T> {
    const sorted = [...todos].sort((a, b) => a.id - b.id);
    const byId = new Map(sorted.map((todo) => [todo.id, todo]));
    const children = new Map<number, T[]>();
    const roots: T[] = [];
    for (const todo of sorted) {
      const parentId = todo.parentId ?? null;
      if (parentId === null || !byId.has(parentId)) roots.push(todo);
      else {
        const siblings = children.get(parentId);
        if (siblings) siblings.push(todo);
        else children.set(parentId, [todo]);
      }
    }
    const tree = new TodoTree(byId, children, roots);
    // Every node must be reachable from a root; the rest sit on a cycle.
    let reachable = 0;
    tree.walk(roots, () => reachable++);
    if (reachable !== byId.size) throw new CorruptHierarchyError();
    return tree;
  }

  get(id: number): T | undefined {
    return this.byId.get(id);
  }

  /** The node and all its descendants, in id order. */
  subtree(rootId: number): T[] {
    const root = this.byId.get(rootId);
    if (!root) return [];
    const nodes: T[] = [];
    this.walk([root], (node) => nodes.push(node));
    return nodes.sort((a, b) => a.id - b.id);
  }

  /**
   * Checks that todo `id` (null for a new todo) may sit below `parentId`.
   * The snapshot must contain the parent's ancestor chain.
   */
  assertCanPlace(id: number | null, parentId: number | null): void {
    let current = parentId;
    const seen = new Set<number>();
    while (current !== null) {
      if (current === id)
        throw new InvalidPlacementError(
          'A todo cannot be moved below itself or a descendant',
        );
      if (seen.has(current)) throw new CorruptHierarchyError();
      seen.add(current);
      const node = this.byId.get(current);
      if (!node) {
        if (current === parentId)
          throw new InvalidPlacementError('Parent is unavailable');
        return; // The chain ends at a node whose parent is gone: a root.
      }
      current = node.parentId ?? null;
    }
  }

  /** Bottom-up progress of every subtree; each node counts once. */
  progress(): Map<number, TodoProgress> {
    const totals = new Map<
      number,
      {
        count: number;
        done: number;
        known: number;
        doneMinutes: number;
        missing: number;
      }
    >();
    const result = new Map<number, TodoProgress>();
    // Reverse pre-order visits every child before its parent (iterative, no depth limit).
    const order: T[] = [];
    this.walk(this.roots, (node) => order.push(node));
    for (const node of order.reverse()) {
      const own = {
        count: 1,
        done: Number(node.completed),
        known: node.plannedDurationMinutes ?? 0,
        doneMinutes: node.completed ? (node.plannedDurationMinutes ?? 0) : 0,
        missing: Number(node.plannedDurationMinutes == null),
      };
      for (const child of this.children.get(node.id) ?? []) {
        const sub = totals.get(child.id)!;
        own.count += sub.count;
        own.done += sub.done;
        own.known += sub.known;
        own.doneMinutes += sub.doneMinutes;
        own.missing += sub.missing;
      }
      totals.set(node.id, own);
      const byDuration = own.missing === 0;
      const completed = byDuration ? own.doneMinutes : own.done;
      const total = byDuration ? own.known : own.count;
      result.set(node.id, {
        mode: byDuration ? 'duration' : 'count',
        completed,
        total,
        percentage: total > 0 ? (completed / total) * 100 : 0,
        knownDurationMinutes: own.known,
        todoCount: own.count,
      });
    }
    return result;
  }

  /** Iterative depth-first walk from `starts`, never visiting a node twice. */
  private walk(starts: T[], visit: (node: T) => void): void {
    const stack = [...starts].reverse();
    const seen = new Set<number>();
    while (stack.length) {
      const node = stack.pop()!;
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      visit(node);
      const next = this.children.get(node.id) ?? [];
      for (let i = next.length - 1; i >= 0; i--) stack.push(next[i]);
    }
  }
}
