import { describe, expect, it } from "vitest";
import { PLANNER_HABIT_FIELDS, PLANNER_TODO_FIELDS } from "../types/fixtures";
import type { DayPlannerHabitItem, DayPlannerTodoItem } from "../types/day-planner";
import { movingLine, postponePlan, stayingLines } from "./postpone";

const todo = (
  todoId: number,
  overrides: Partial<DayPlannerTodoItem> = {},
): DayPlannerTodoItem =>
  ({
    ...PLANNER_TODO_FIELDS,
    type: "todo",
    todoId,
    title: `Quest ${todoId}`,
    status: "pending",
    ...overrides,
  }) as DayPlannerTodoItem;
const run = (
  occurrenceId: number,
  moveUntil: string | null,
): DayPlannerHabitItem =>
  ({
    ...PLANNER_HABIT_FIELDS,
    type: "habit",
    occurrenceId,
    title: `Daily ${occurrenceId}`,
    status: "pending",
    moveUntil,
  }) as DayPlannerHabitItem;
const none = () => false;

describe("Auf morgen: what moves and what stays", () => {
  it("moves quests, appointments and runs whose window reaches tomorrow", () => {
    const plan = postponePlan(
      [todo(1), todo(2, { timeOfDay: "14:00" }), run(3, "2026-10-04"), run(4, "2026-10-02"), run(5, null)],
      "2026-10-03",
      none,
    );
    expect(plan.moving.map(({ title }) => title)).toEqual(["Quest 1", "Quest 2", "Daily 3"]);
    expect(plan.staying.map(({ item, reason }) => [item.title, reason])).toEqual([
      ["Daily 4", "window"],
      ["Daily 5", "window"],
    ]);
  });

  it("keeps what is done or whose stopwatch runs", () => {
    const plan = postponePlan(
      [todo(1, { status: "completed" }), todo(2)],
      "2026-10-03",
      (item) => item.type === "todo" && item.todoId === 2,
    );
    expect(plan.moving).toEqual([]);
    expect(stayingLines(plan.staying)).toEqual([
      "„Quest 2“ bleibt: Die Stoppuhr läuft noch.",
    ]);
  });

  it("says it in sentences", () => {
    expect(
      stayingLines([
        { item: run(1, null), reason: "window" },
        { item: run(2, null), reason: "window" },
        { item: run(3, null), reason: "window" },
      ]),
    ).toEqual(["„Daily 1“, „Daily 2“ und „Daily 3“ bleiben: Ihr Zeitraum endet heute."]);
    expect(movingLine([todo(1)])).toBe(
      "1 offener Eintrag wandert auf morgen und reiht sich dort hinten ein.",
    );
    expect(movingLine([todo(1), todo(2, { timeOfDay: "09:00" })])).toBe(
      "2 offene Einträge wandern auf morgen und reihen sich dort hinten ein. Termine behalten ihre Uhrzeit.",
    );
  });
});
