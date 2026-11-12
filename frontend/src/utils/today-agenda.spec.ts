import { describe, expect, it } from "vitest";
import { PLANNER_HABIT_FIELDS, PLANNER_TODO_FIELDS } from "../types/fixtures";
import type {
  DayPlannerHabitItem,
  DayPlannerResponse,
  DayPlannerTodoItem,
} from "../types/day-planner";
import {
  arrangeToday,
  formatDayHeading,
  formatDuration,
} from "./today-agenda";

const todo = (
  overrides: Partial<DayPlannerTodoItem> = {},
): DayPlannerTodoItem => ({
  ...PLANNER_TODO_FIELDS,
  type: "todo",
  todoId: 1,
  title: "Todo",
  status: "pending",
  scheduledDate: "2026-10-02",
  scheduledAt: null,
  completedAt: null,
  plannedDurationMinutes: null,
  isFixed: false,
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
  title: "Habit",
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
});
// Berlin is UTC+2 on 2 October.
const at = (hours: number, minutes = 0) => hours * 60 + minutes;

describe("arrangeToday", () => {
  it("focuses the timed item that is not over yet", () => {
    const early = todo({
      todoId: 1,
      title: "Früh",
      scheduledAt: "2026-10-02T06:00:00Z",
      plannedDurationMinutes: 30,
    });
    const later = todo({
      todoId: 2,
      title: "Später",
      scheduledAt: "2026-10-02T10:00:00Z",
    });
    const agenda = arrangeToday(planner([early, later]), at(9));
    expect(agenda.focus?.title).toBe("Später");
    // The missed early item stays on the axis, before "now".
    expect(agenda.timeline.map((entry) => entry.time)).toEqual(["08:00"]);
    expect(agenda.nowIndex).toBe(1);
  });

  it("keeps an item in focus while its duration runs", () => {
    const running = todo({
      scheduledAt: "2026-10-02T07:00:00Z",
      plannedDurationMinutes: 60,
    });
    expect(arrangeToday(planner([running]), at(9, 30)).focus).toBe(running);
  });

  it("falls back to an untimed item and names the next timed step", () => {
    const anytime = habit({ title: "Lesen" });
    const meeting = todo({ scheduledAt: "2026-10-02T12:00:00Z" });
    const agenda = arrangeToday(
      planner(
        [anytime, meeting],
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
    expect(agenda.focus?.title).toBe("Todo");
    expect(agenda.next).toMatchObject({ kind: "event", time: "11:00" });
    expect(agenda.anytime).toEqual([anytime]);
  });

  it("separates carried-over and resolved items and counts only today", () => {
    const overdue = todo({ todoId: 3, isOverdue: true });
    const done = habit({ occurrenceId: 2, status: "completed" });
    const open = habit({ occurrenceId: 3, timeOfDay: "18:00" });
    const agenda = arrangeToday(planner([overdue, done, open]), at(8));
    expect(agenda.carriedOver).toEqual([overdue]);
    expect(agenda.resolved).toEqual([done]);
    expect(agenda.focus).toBe(open);
    expect([agenda.done, agenda.total]).toEqual([1, 2]);
  });

  it("has no focus when everything is resolved", () => {
    const agenda = arrangeToday(
      planner([habit({ status: "skipped" })]),
      at(8),
    );
    expect(agenda.focus).toBeNull();
    expect(agenda.next).toBeNull();
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
