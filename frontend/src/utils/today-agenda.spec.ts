import { describe, expect, it } from "vitest";
import {
  NO_QUEST_HOURS,
  PLANNER_HABIT_FIELDS,
  PLANNER_TODO_FIELDS,
} from "../types/fixtures";
import type {
  DayPlannerHabitItem,
  DayPlannerResponse,
  DayPlannerTodoItem,
} from "../types/day-planner";
import {
  arrangeToday,
  formatDayHeading,
  formatDuration,
  itemKey,
  moved,
  withQueueOrder,
} from "./today-agenda";

const todo = (
  overrides: Partial<DayPlannerTodoItem> = {},
): DayPlannerTodoItem => ({
  ...PLANNER_TODO_FIELDS,
  type: "todo",
  todoId: 1,
  title: "Quest",
  status: "pending",
  scheduledDate: "2026-10-02",
  completedAt: null,
  plannedDurationMinutes: null,
  isOverdue: false,
  timerEligible: true,
  ...overrides,
});
const habit = (
  overrides: Partial<DayPlannerHabitItem> = {},
): DayPlannerHabitItem => ({
  ...PLANNER_HABIT_FIELDS,
  type: "habit",
  occurrenceId: 1,
  habitId: 1,
  title: "Daily",
  status: "pending",
  scheduledDate: "2026-10-02",
  plannedDurationMinutes: null,
  moveUntil: null,
  scheduleType: "interval",
  isOverdue: false,
  timerEligible: true,
  ...overrides,
});
const planner = (
  items: DayPlannerResponse["items"],
  externalEvents: DayPlannerResponse["externalEvents"] = [],
): DayPlannerResponse => ({
  date: "2026-10-02",
  items,
  externalEvents,
  workedMinutes: 0,
  questHours: NO_QUEST_HOURS,
});
const at = (hours: number, minutes = 0) => hours * 60 + minutes;

describe("arrangeToday", () => {
  it("puts the head of the order into focus, whatever the clock says", () => {
    const first = todo({ todoId: 1, title: "Erstes" });
    const second = habit({ occurrenceId: 2, title: "Zweites" });
    const later = todo({ todoId: 3, title: "Termin", timeOfDay: "15:00" });
    const agenda = arrangeToday(planner([later, first, second]), at(9));
    expect(agenda.focus).toBe(first);
    expect(agenda.queue).toEqual([first, second]);
    // The appointment waits on the axis, after "now".
    expect(agenda.timeline.map((entry) => entry.time)).toEqual(["15:00"]);
    expect(agenda.nowIndex).toBe(0);
  });

  it("lets a running appointment come before the order", () => {
    const first = todo({ todoId: 1, title: "Erstes" });
    const meeting = todo({
      todoId: 2,
      title: "Besprechung",
      timeOfDay: "09:00",
      plannedDurationMinutes: 60,
    });
    const during = arrangeToday(planner([meeting, first]), at(9, 30));
    expect(during.focus).toBe(meeting);
    expect(during.queue).toEqual([first]);
    expect(during.timeline).toEqual([]);
    // Once it is over, the order is back in focus and it stays on the axis.
    const after = arrangeToday(planner([meeting, first]), at(10));
    expect(after.focus).toBe(first);
    expect(after.timeline.map((entry) => entry.time)).toEqual(["09:00"]);
    expect(after.nowIndex).toBe(1);
  });

  it("counts an appointment without a duration as half an hour", () => {
    const meeting = todo({ timeOfDay: "09:00" });
    const first = todo({ todoId: 2 });
    expect(arrangeToday(planner([meeting, first]), at(9, 29)).focus).toBe(
      meeting,
    );
    expect(arrangeToday(planner([meeting, first]), at(9, 30)).focus).toBe(
      first,
    );
  });

  it("falls back to the next appointment, then to a missed one", () => {
    const missed = todo({ todoId: 1, timeOfDay: "08:00" });
    const next = habit({ occurrenceId: 2, timeOfDay: "18:00" });
    expect(arrangeToday(planner([missed, next]), at(12)).focus).toBe(next);
    expect(arrangeToday(planner([missed]), at(12)).focus).toBe(missed);
  });

  it("shows calendar events on the axis with timed items", () => {
    const meeting = todo({ timeOfDay: "14:00" });
    const agenda = arrangeToday(
      planner(
        [habit({ title: "Lesen" }), meeting],
        [
          {
            id: 7,
            title: "Zahnarzt",
            start: "2026-10-02T09:00:00Z",
            end: "2026-10-02T10:00:00Z",
          },
        ],
      ),
      at(8),
    );
    // Berlin is UTC+2 on 2 October.
    expect(agenda.timeline.map((entry) => [entry.kind, entry.time])).toEqual([
      ["event", "11:00"],
      ["item", "14:00"],
    ]);
  });

  it("separates carried-over and resolved items and counts only today", () => {
    const overdue = todo({ todoId: 3, isOverdue: true });
    const done = habit({ occurrenceId: 2, status: "completed" });
    const open = habit({ occurrenceId: 3, timeOfDay: "18:00" });
    const agenda = arrangeToday(planner([overdue, done, open]), at(8));
    expect(agenda.carriedOver).toEqual([overdue]);
    expect(agenda.resolved).toEqual([done]);
    expect(agenda.focus).toBe(open);
    expect(agenda.queue).toEqual([]);
    expect([agenda.done, agenda.total]).toEqual([1, 2]);
  });

  it("has no focus when everything is resolved", () => {
    const agenda = arrangeToday(
      planner([habit({ status: "skipped" })]),
      at(8),
    );
    expect(agenda.focus).toBeNull();
    expect(agenda.queue).toEqual([]);
  });
});

describe("sorting the order of the day", () => {
  it("moves one entry and leaves bad moves alone", () => {
    expect(moved(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moved(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moved(["a", "b", "c"], 0, 3)).toEqual(["a", "b", "c"]);
    expect(moved(["a", "b", "c"], -1, 1)).toEqual(["a", "b", "c"]);
  });

  it("keys todos and habit occurrences apart", () => {
    expect(itemKey(todo({ todoId: 4 }))).toBe("todo-4");
    expect(itemKey(habit({ occurrenceId: 4 }))).toBe("habit-4");
  });

  it("reorders only the queue and keeps everything else in place", () => {
    const meeting = todo({ todoId: 1, timeOfDay: "09:00" });
    const first = todo({ todoId: 2 });
    const done = habit({ occurrenceId: 3, status: "completed" });
    const second = habit({ occurrenceId: 4 });
    const before = planner([meeting, first, done, second]);
    expect(withQueueOrder(before, [second, first]).items).toEqual([
      meeting,
      second,
      done,
      first,
    ]);
    expect(before.items[1]).toBe(first);
  });
});

describe("formatting", () => {
  it("writes the day with its weekday", () => {
    expect(formatDayHeading("2026-11-12")).toBe("Donnerstag, 12. Nov.");
  });

  it("writes durations in hours and minutes", () => {
    expect(formatDuration(25)).toBe("25 Min.");
    expect(formatDuration(60)).toBe("1 Std.");
    expect(formatDuration(70)).toBe("1 Std. 10 Min.");
  });
});
