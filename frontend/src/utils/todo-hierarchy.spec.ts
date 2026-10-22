import { describe, it, expect } from "vitest";
import { visibleHierarchy, descendantIds } from "./todo-hierarchy";
import type { HierarchyTodo } from "../types/todo-hierarchy";
const node = (id: number, parentId: number | null): HierarchyTodo => ({
  id,
  parentId,
  title: `Todo ${id}`,
  completed: false,
  completedAt: null,
  scheduledAt: null,
  plannedDurationMinutes: null,
  isFixed: false,
  progress: {
    mode: "count",
    completed: 0,
    total: 1,
    percentage: 0,
    knownDurationMinutes: 0,
    todoCount: 1,
  },
});
describe("Iterative hierarchy navigation", () => {
  it("retains parent and intermediate nodes once in depth-first order", () => {
    expect(
      visibleHierarchy(
        [node(1, null), node(2, 1), node(3, 2), node(4, null)],
        new Set(),
      ).map((r) => [r.todo.id, r.depth]),
    ).toEqual([
      [1, 0],
      [2, 1],
      [3, 2],
      [4, 0],
    ]);
  });
  it("collapses descendants without losing their data", () => {
    const rows = [node(1, null), node(2, 1), node(3, 2)];
    expect(visibleHierarchy(rows, new Set([1])).map((r) => r.todo.id)).toEqual([
      1,
    ]);
    expect(descendantIds(rows, 1)).toEqual(new Set([1, 2, 3]));
  });
  it("handles a 20,000-level chain without recursive calls", () => {
    const rows = Array.from({ length: 20000 }, (_, i) =>
      node(i + 1, i ? i : null),
    );
    expect(visibleHierarchy(rows, new Set()).length).toBe(20000);
    expect(descendantIds(rows, 1).size).toBe(20000);
  });
});
