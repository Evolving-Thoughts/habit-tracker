import { describe, expect, it } from "vitest";
import { TODO_FIELDS } from "../types/fixtures";
import type { HierarchyTodo } from "../types/todo-hierarchy";
import {
  goalWords,
  nextQuest,
  questDay,
  readyToComplete,
  runningGoal,
} from "./campaign-next";

const todo = (
  id: number,
  parentId: number | null,
  completed = false,
): HierarchyTodo => ({
  ...TODO_FIELDS,
  id,
  parentId,
  title: `Quest ${id}`,
  completed,
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
});

describe("nextQuest", () => {
  it("takes the first open quest in the campaign's order", () => {
    const todos = [todo(1, null), todo(2, 1, true), todo(3, 1), todo(4, 1)];
    expect(nextQuest(todos, 1)?.id).toBe(3);
  });

  it("goes into a Questreihe with open quests instead of naming it", () => {
    const todos = [
      todo(1, null),
      todo(2, 1),
      todo(5, 2, true),
      todo(6, 2),
      todo(3, 1),
    ];
    expect(nextQuest(todos, 1)?.id).toBe(6);
  });

  it("names a Questreihe whose quests are all done", () => {
    const todos = [todo(1, null), todo(2, 1), todo(5, 2, true)];
    expect(nextQuest(todos, 1)?.id).toBe(2);
  });

  it("has none when everything below is done, and never the campaign", () => {
    expect(nextQuest([todo(1, null), todo(2, 1, true)], 1)).toBeNull();
    expect(nextQuest([todo(1, null)], 1)).toBeNull();
  });
});

describe("nextQuest by day", () => {
  const TODAY = "2026-11-25";
  const on = (
    id: number,
    parentId: number,
    scheduledDate: string | null,
    timeOfDay: string | null = null,
    completed = false,
  ) => ({ ...todo(id, parentId, completed), scheduledDate, timeOfDay });

  it("prefers a quest planned for today over the page order (Umzug)", () => {
    const todos = [
      todo(1, null),
      on(2, 1, "2026-11-21", null, true),
      on(3, 2, "2026-11-21", null, true),
      on(4, 2, "2026-11-27"),
      on(5, 1, TODAY, "10:00"),
      on(6, 1, "2026-11-28"),
      on(7, 1, null),
    ];
    expect(nextQuest(todos, 1, TODAY)?.id).toBe(5);
  });

  it("takes today's earliest time first, then today's untimed ones", () => {
    const todos = [
      todo(1, null),
      on(2, 1, TODAY),
      on(3, 1, TODAY, "14:00"),
      on(4, 1, TODAY, "09:30"),
    ];
    expect(nextQuest(todos, 1, TODAY)?.id).toBe(4);
    expect(nextQuest([todo(1, null), on(2, 1, TODAY)], 1, TODAY)?.id).toBe(2);
  });

  it("then a left-over quest, the earliest day first", () => {
    const todos = [
      todo(1, null),
      on(2, 1, "2026-11-26"),
      on(3, 1, "2026-11-23"),
      on(4, 1, "2026-11-20"),
      on(5, 1, null),
    ];
    expect(nextQuest(todos, 1, TODAY)?.id).toBe(4);
  });

  it("then the next planned day, then the page order", () => {
    expect(
      nextQuest(
        [todo(1, null), on(2, 1, null), on(3, 1, "2026-12-03"), on(4, 1, "2026-11-27")],
        1,
        TODAY,
      )?.id,
    ).toBe(4);
    expect(
      nextQuest([todo(1, null), on(2, 1, null), on(3, 1, null)], 1, TODAY)?.id,
    ).toBe(2);
  });
});

describe("running daily goal", () => {
  const goal = (reached: boolean) => ({
    habitId: 3,
    habitTitle: "Laufen gehen",
    target: 24,
    completed: reached ? 24 : 9,
    reached,
  });
  const campaign = (
    done: number,
    all: number,
    habitGoal: ReturnType<typeof goal> | null,
    periodEnd: string | null = "2027-01-20",
  ) => ({
    ...todo(1, null),
    habitGoal,
    periodEnd,
    progress: { ...todo(1, null).progress, todoCount: all, doneCount: done },
  });

  it("runs while it is not reached and its period not over", () => {
    expect(runningGoal(campaign(2, 2, goal(false)), "2026-11-25")).not.toBeNull();
    expect(runningGoal(campaign(2, 2, goal(true)), "2026-11-25")).toBeNull();
    expect(
      runningGoal(campaign(2, 2, goal(false), "2026-11-24"), "2026-11-25"),
    ).toBeNull();
    expect(runningGoal(campaign(2, 2, null), "2026-11-25")).toBeNull();
    expect(goalWords(goal(false))).toBe("Laufen gehen 9 von 24");
  });

  it("is ready to complete only when no quest and no goal is open", () => {
    const today = "2026-11-25";
    expect(readyToComplete(campaign(2, 2, null), today)).toBe(true);
    expect(readyToComplete(campaign(1, 2, null), today)).toBe(false);
    expect(readyToComplete(campaign(2, 2, goal(false)), today)).toBe(false);
    expect(readyToComplete(campaign(2, 2, goal(true)), today)).toBe(true);
    expect(readyToComplete(campaign(0, 0, goal(true)), today)).toBe(true);
    // Nothing below and no goal: nothing to finish, it waits in the "…".
    expect(readyToComplete(campaign(0, 0, null), today)).toBe(false);
  });
});

describe("questDay", () => {
  it.each([
    [null, null],
    ["2026-11-25", "heute"],
    ["2026-11-26", "morgen"],
    ["2026-12-03", "03.12."],
    ["2026-11-20", "20.11."],
  ])("says %p as %p", (date, word) => {
    expect(questDay(date, "2026-11-25")).toBe(word);
  });
});
