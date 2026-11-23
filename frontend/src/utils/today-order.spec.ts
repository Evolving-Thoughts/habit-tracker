import { describe, expect, it } from "vitest";
import { NO_QUEST_HOURS, PLANNER_TODO_FIELDS } from "../types/fixtures";
import type {
  DayPlannerResponse,
  DayPlannerTodoItem,
} from "../types/day-planner";
import { arrangeToday } from "./today-agenda";
import {
  dropInDay,
  postponedToEnd,
  sortableRows,
  stepInDay,
} from "./today-order";

const quest = (
  todoId: number,
  dayPosition: number,
  timeOfDay: string | null = null,
): DayPlannerTodoItem => ({
  ...PLANNER_TODO_FIELDS,
  type: "todo",
  todoId,
  title: `Q${todoId}`,
  status: "pending",
  scheduledDate: "2026-10-02",
  completedAt: null,
  plannedDurationMinutes: null,
  isOverdue: false,
  timerEligible: true,
  timeOfDay,
  dayPosition,
});
const day = (items: DayPlannerResponse["items"]): DayPlannerResponse => ({
  date: "2026-10-02",
  items,
  externalEvents: [],
  workedMinutes: 0,
  questHours: NO_QUEST_HOURS,
});
/* Nine o'clock: no appointment runs, the head of the order is in focus. */
const nine = 9 * 60;
const ids = (order: { id: number }[]) => order.map(({ id }) => id);

describe("dropInDay", () => {
  it("places a row before the one it crossed and says where it stands", () => {
    const planner = day([quest(1, 0), quest(2, 1), quest(3, 2)]);
    const agenda = arrangeToday(planner, nine);
    const move = dropInDay(planner, agenda, 2, 1)!;
    expect(ids(move.order)).toEqual([1, 3, 2]);
    expect(move.message).toBe("„Q3“ steht jetzt an Stelle 2 von 3.");
    const shown = arrangeToday(move.planner, nine).sequence;
    expect(shown.map((item) => item.type === "todo" && item.todoId)).toEqual([
      1, 3, 2,
    ]);
  });

  it("sorts the focus card by what is on screen", () => {
    const planner = day([quest(1, 0), quest(2, 1), quest(3, 2)]);
    const agenda = arrangeToday(planner, nine);
    expect(sortableRows(agenda)[0]).toBe(agenda.focus);
    expect(ids(dropInDay(planner, agenda, 0, 1)!.order)).toEqual([2, 1, 3]);
  });

  it("keeps an appointment on the clock among the others", () => {
    const planner = day([
      quest(1, 0),
      quest(2, 1, "10:00"),
      quest(3, 2, "14:00"),
      quest(4, 3),
    ]);
    const agenda = arrangeToday(planner, nine);
    expect(ids(dropInDay(planner, agenda, 2, 1)!.order)).toEqual([1, 2, 3, 4]);
    expect(ids(dropInDay(planner, agenda, 3, 1)!.order)).toEqual([1, 4, 2, 3]);
  });

  it("changes nothing without a stored row crossed", () => {
    const planner = day([quest(1, 0), quest(2, 1)]);
    const agenda = arrangeToday(planner, nine);
    expect(dropInDay(planner, agenda, 1, 1)).toBeNull();
    expect(dropInDay(planner, agenda, 5, 0)).toBeNull();
  });
});

describe("stepInDay", () => {
  it("steps one row and never past an appointment on the clock", () => {
    const planner = day([
      quest(1, 0),
      quest(2, 1, "10:00"),
      quest(3, 2, "14:00"),
      quest(4, 3),
    ]);
    const agenda = arrangeToday(planner, nine);
    const [first, early, late, last] = sortableRows(agenda);
    expect(stepInDay(agenda, last!, -1)).toBe(2);
    expect(stepInDay(agenda, late!, -1)).toBeNull();
    expect(stepInDay(agenda, early!, 1)).toBeNull();
    expect(stepInDay(agenda, first!, -1)).toBeNull();
  });
});

describe("postponedToEnd", () => {
  it("sends one item to the end and keeps the rest in order", () => {
    const items = [quest(1, 0), quest(2, 1), quest(3, 2)];
    expect(postponedToEnd(items, items[0]!)).toEqual([
      { type: "todo", id: 2 },
      { type: "todo", id: 3 },
      { type: "todo", id: 1 },
    ]);
  });
});
