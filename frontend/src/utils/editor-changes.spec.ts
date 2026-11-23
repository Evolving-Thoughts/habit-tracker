import { describe, expect, it } from "vitest";
import { HABIT_FIELDS, TODO_FIELDS } from "../types/fixtures";
import type { HabitResponse } from "../types/habit";
import type { TodoResponse } from "../types/todo";
import {
  habitChanges,
  todoChanges,
  type HabitFields,
  type TodoFields,
} from "./editor-changes";

const todo: TodoResponse = {
  ...TODO_FIELDS,
  id: 1,
  parentId: null,
  title: "Steuer",
  completed: false,
  completedAt: null,
  scheduledDate: "2026-10-02",
  timeOfDay: null,
  plannedDurationMinutes: 30,
  timerEligible: true,
};
/** The form as `todo` fills it. */
const asLoaded: TodoFields = {
  title: "Steuer",
  date: "2026-10-02",
  time: "",
  duration: 30,
  parentId: null,
  categoryId: null,
  why: "",
  periodStart: "",
  periodEnd: "",
  goalHabitId: null,
  goalTarget: "",
  weeklyTarget: "",
  color: null,
  icon: null,
};
const base = {
  title: "Steuer",
  scheduledDate: "2026-10-02",
  timeOfDay: null,
  plannedDurationMinutes: 30,
};

describe("todoChanges", () => {
  it("sends only title, day, time and duration for an untouched quest", () => {
    expect(todoChanges(asLoaded, todo)).toEqual(base);
  });

  it("adds the reason, category and place only when they changed", () => {
    expect(
      todoChanges(
        { ...asLoaded, why: "  weil ", categoryId: 4, parentId: 9 },
        todo,
      ),
    ).toEqual({ ...base, why: "weil", categoryId: 4, parentId: 9 });
    expect(todoChanges(asLoaded, { ...todo, why: "alt" })).toEqual({
      ...base,
      why: null,
    });
  });

  it("sends campaign colour, icon and weekly goal at the top only", () => {
    const fields = { ...asLoaded, color: "teal", weeklyTarget: "2" };
    expect(todoChanges(fields, todo)).toEqual({
      ...base,
      color: "teal",
      weeklyTargetMinutes: 120,
    });
    expect(todoChanges({ ...fields, parentId: 9 }, todo)).toEqual({
      ...base,
      parentId: 9,
    });
  });

  it("validates the goal and the shared quest rules", () => {
    expect(() =>
      todoChanges({ ...asLoaded, goalHabitId: 3, goalTarget: "0" }, todo),
    ).toThrow("Die Sollmenge muss eine ganze Zahl ab 1 sein.");
    expect(() =>
      todoChanges({ ...asLoaded, date: "", time: "09:00" }, todo),
    ).toThrow("Ein fester Termin braucht einen Tag.");
    expect(
      todoChanges({ ...asLoaded, goalHabitId: 3, goalTarget: "5" }, todo),
    ).toEqual({ ...base, goalHabitId: 3, goalTarget: 5 });
  });
});

const habit: HabitResponse = {
  ...HABIT_FIELDS,
  id: 10,
  title: "Joggen",
  isActive: true,
  plannedDurationMinutes: null,
  timerOccurrenceId: null,
  timerDurationMinutes: null,
  currentSchedule: null,
  upcomingSchedule: null,
};
const habitAsLoaded: HabitFields = {
  title: "Joggen",
  isActive: true,
  campaignId: null,
  duration: "",
  timeOfDay: "",
  categoryId: null,
  why: "",
};

describe("habitChanges", () => {
  it("sends nothing for an untouched daily", () => {
    expect(habitChanges(habitAsLoaded, habit)).toEqual({});
  });

  it("sends each changed field on its own", () => {
    expect(
      habitChanges(
        {
          ...habitAsLoaded,
          title: " Laufen ",
          isActive: false,
          campaignId: 2,
          duration: "20",
          timeOfDay: "07:30",
        },
        habit,
      ),
    ).toEqual({
      title: "Laufen",
      isActive: false,
      campaignId: 2,
      plannedDurationMinutes: 20,
      timeOfDay: "07:30",
    });
    expect(
      habitChanges(habitAsLoaded, { ...habit, timeOfDay: "07:30" }),
    ).toEqual({ timeOfDay: null });
  });

  it("refuses an empty title", () => {
    expect(() => habitChanges({ ...habitAsLoaded, title: " " }, habit)).toThrow(
      "Der Titel muss 1 bis 200 Zeichen enthalten.",
    );
  });
});
