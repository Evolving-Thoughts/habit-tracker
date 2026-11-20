import { TODO_FIELDS } from "../types/fixtures";
import { describe, it, expect } from "vitest";
import {
  hasProgress,
  openBelow,
  progressText,
  progressWords,
  questWord,
  visibleHierarchy,
} from "./todo-hierarchy";
import type { HierarchyTodo, TodoProgress } from "../types/todo-hierarchy";
const node = (id: number, parentId: number | null): HierarchyTodo => ({
    ...TODO_FIELDS,
  id,
  parentId,
  title: `Quest ${id}`,
  completed: false,
  timerEligible: true,
  completedAt: null,
  scheduledDate: null,
  timeOfDay: null,
  plannedDurationMinutes: null,
  progress: {
    mode: "count",
    completed: 0,
    total: 0,
    percentage: 0,
    knownDurationMinutes: 0,
    todoCount: 0,
    doneCount: 0,
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
  });
  it("handles a 20,000-level chain without recursive calls", () => {
    const rows = Array.from({ length: 20000 }, (_, i) =>
      node(i + 1, i ? i : null),
    );
    expect(visibleHierarchy(rows, new Set()).length).toBe(20000);
  });
});

describe("progress as the server counts it", () => {
  const progress = (changes: Partial<TodoProgress>): TodoProgress => ({
    mode: "count",
    completed: 0,
    total: 0,
    percentage: 0,
    knownDurationMinutes: 0,
    todoCount: 0,
    doneCount: 0,
    ...changes,
  });

  it("shows nothing for a quest without quests below", () => {
    expect(hasProgress(progress({}))).toBe(false);
    expect(hasProgress(progress({ todoCount: 3, total: 3 }))).toBe(true);
  });

  it("names a campaign with three quests, one done, 1/3, not 1/4", () => {
    const below = progress({
      completed: 1,
      total: 3,
      todoCount: 3,
      doneCount: 1,
    });
    expect(progressText(below)).toBe("1/3");
    expect(progressWords(below)).toBe("1 von 3 Quests darunter erledigt");
    expect(openBelow(below)).toBe(2);
  });

  it("says one quest below in the singular", () => {
    const one = progress({ completed: 0, total: 1, todoCount: 1 });
    expect(progressWords(one)).toBe("0 von 1 Quest darunter erledigt");
    expect(questWord(1)).toBe("Quest");
    expect(questWord(-1)).toBe("Quest");
    expect(questWord(0)).toBe("Quests");
    expect(questWord(2)).toBe("Quests");
  });

  it("names minutes when every quest below has a duration", () => {
    const below = progress({
      mode: "duration",
      completed: 30,
      total: 90,
      todoCount: 2,
      doneCount: 1,
    });
    expect(progressText(below)).toBe("30/90 Min.");
    expect(progressWords(below)).toBe("30 von 90 Minuten darunter erledigt");
    expect(openBelow(below)).toBe(1);
  });
});
