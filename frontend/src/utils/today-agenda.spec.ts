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
  DEFAULT_APPOINTMENT_MINUTES,
  arrangeToday,
  currentItem,
  formatDayHeading,
  formatDuration,
  formatWindow,
  itemKey,
  moved,
  nextChangeAt,
  soonAppointment,
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
  it("keeps the manually ordered head in focus before or after its appointment", () => {
    const early = todo({ timeOfDay: "10:00", dayPosition: 0 });
    const late = habit({ timeOfDay: "14:30", dayPosition: 1 });
    const day = planner([early, late, todo({ todoId: 3, dayPosition: 2 })]);
    expect(arrangeToday(day, at(9)).focus).toBe(early);
    expect(arrangeToday(day, at(14, 32)).focus).toBe(early);
  });
  it("puts the head of the order into focus, whatever the clock says", () => {
    const first = todo({ todoId: 1, title: "Erstes" });
    const second = habit({ occurrenceId: 2, title: "Zweites" });
    const later = todo({ todoId: 3, title: "Termin", timeOfDay: "15:00" });
    const agenda = arrangeToday(planner([later, first, second]), at(9));
    expect(agenda.focus).toBe(first);
    expect(agenda.queue).toEqual([first, second]);
    // The appointment waits in the list by its time; it is still ahead.
    expect(agenda.appointments.map((entry) => entry.time)).toEqual(["15:00"]);
    expect(agenda.appointments[0]!.past).toBe(false);
    expect(agenda.nextAppointment?.time).toBe("15:00");
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
    expect(during.appointments).toEqual([]);
    // Once it is over, the order is back in focus and it stays, as past.
    const after = arrangeToday(planner([meeting, first]), at(10));
    expect(after.focus).toBe(first);
    expect(
      after.appointments.map((entry) => [entry.time, entry.past]),
    ).toEqual([["09:00", true]]);
    expect(after.nextAppointment).toBeNull();
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

  it("never lets a coming or a missed appointment stand in for an empty order", () => {
    const missed = todo({ todoId: 1, timeOfDay: "08:00" });
    const next = habit({ occurrenceId: 2, timeOfDay: "18:00" });
    const agenda = arrangeToday(planner([missed, next]), at(12));
    expect(agenda.focus).toBeNull();
    expect(agenda.focusWindow).toBeNull();
    // Both wait in the list: the missed one is over, the next one ahead.
    expect(
      agenda.appointments.map((entry) => [entry.time, entry.past]),
    ).toEqual([
      ["08:00", true],
      ["18:00", false],
    ]);
    expect(agenda.nextAppointment?.time).toBe("18:00");
  });

  it("gives the focus the window of a running appointment", () => {
    const meeting = habit({ timeOfDay: "07:00", plannedDurationMinutes: 20 });
    const agenda = arrangeToday(planner([meeting]), at(7, 5));
    expect(agenda.focus).toBe(meeting);
    expect(agenda.focusWindow).toEqual({ start: at(7), end: at(7, 20) });
  });

  it("lists calendar events with timed items, over once they end", () => {
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
    expect(agenda.appointments.map((entry) => [entry.kind, entry.time])).toEqual([
      ["event", "11:00"],
      ["item", "14:00"],
    ]);
    const later = arrangeToday(
      planner(
        [],
        [
          {
            id: 7,
            title: "Zahnarzt",
            start: "2026-10-02T09:00:00Z",
            end: "2026-10-02T10:00:00Z",
          },
        ],
      ),
      at(12),
    );
    expect(later.appointments[0]!.past).toBe(true);
  });

  it("separates carried-over and resolved items and counts only today", () => {
    const overdue = todo({ todoId: 3, isOverdue: true });
    const done = habit({ occurrenceId: 2, status: "completed" });
    const open = habit({ occurrenceId: 3, timeOfDay: "18:00" });
    const agenda = arrangeToday(planner([overdue, done, open]), at(8));
    expect(agenda.carriedOver).toEqual([overdue]);
    expect(agenda.resolved).toEqual([done]);
    // The daily at 18:00 waits for its turn in the list.
    expect(agenda.focus).toBeNull();
    expect(agenda.queue).toEqual([]);
    expect(agenda.tally).toEqual({
      completed: 1,
      open: 1,
      carriedOver: 1,
      skipped: 0,
    });
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

describe("currentItem: what is up now, for Heute and the Fokus-Modus", () => {
  const first = todo({ todoId: 1, title: "Erstes" });
  const second = todo({ todoId: 2, title: "Zweites" });
  const call = todo({
    todoId: 3,
    title: "Anruf",
    timeOfDay: "10:00",
    plannedDurationMinutes: 45,
  });

  it("is the head of the order before an appointment starts", () => {
    expect(currentItem([call, first, second], [first, second], at(9, 59))).toBe(
      first,
    );
  });

  it("is the appointment from its start until its end", () => {
    const pending = [call, first, second];
    expect(currentItem(pending, [first, second], at(10))).toBe(call);
    expect(currentItem(pending, [first, second], at(10, 44))).toBe(call);
    expect(currentItem(pending, [first, second], at(10, 45))).toBe(first);
  });

  it("gives an appointment without a duration its default turn", () => {
    const short = todo({ todoId: 4, timeOfDay: "10:00" });
    expect(DEFAULT_APPOINTMENT_MINUTES).toBe(30);
    expect(currentItem([short, first], [first], at(10, 29))).toBe(short);
    expect(currentItem([short, first], [first], at(10, 30))).toBe(first);
  });

  it("takes the appointment that began last when several overlap", () => {
    const later = habit({
      occurrenceId: 5,
      timeOfDay: "10:15",
      plannedDurationMinutes: 10,
    });
    const pending = [call, later, first];
    expect(currentItem(pending, [first], at(10, 20))).toBe(later);
    // Once the short one is over, the longer one is up again.
    expect(currentItem(pending, [first], at(10, 25))).toBe(call);
  });

  it("is nothing when the order is empty and no appointment is up", () => {
    expect(currentItem([call], [], at(9))).toBeNull();
    expect(currentItem([call], [], at(11))).toBeNull();
    expect(currentItem([], [], at(11))).toBeNull();
  });
});

describe("nextChangeAt: when the focus card can change", () => {
  it("names the next start, the minute after it and the end", () => {
    const call = todo({ timeOfDay: "10:00", plannedDurationMinutes: 45 });
    const day = planner([call, todo({ todoId: 2 })]);
    expect(nextChangeAt(day, at(9))).toBe(at(10));
    expect(nextChangeAt(day, at(10))).toBe(at(10, 1));
    expect(nextChangeAt(day, at(10, 1))).toBe(at(10, 45));
    expect(nextChangeAt(day, at(10, 45))).toBeNull();
  });

  it("waits for calendar events passing \"now\", ignores what is done", () => {
    const done = todo({ timeOfDay: "09:00", status: "completed" });
    const day = planner(
      [done],
      [
        {
          id: 1,
          title: "Zahnarzt",
          start: "2026-10-02T12:00:00Z",
          end: "2026-10-02T13:00:00Z",
        },
      ],
    );
    // 14:00 in Berlin; the line passes it a minute later.
    expect(nextChangeAt(day, at(8))).toBe(at(14, 1));
  });

  it("also wakes the lead time before each start when asked to", () => {
    const call = todo({ timeOfDay: "10:00", plannedDurationMinutes: 45 });
    const day = planner(
      [call],
      [
        {
          id: 1,
          title: "Zahnarzt",
          start: "2026-10-02T12:00:00Z",
          end: "2026-10-02T13:00:00Z",
        },
      ],
    );
    expect(nextChangeAt(day, at(9), 15)).toBe(at(9, 45));
    expect(nextChangeAt(day, at(9, 45), 15)).toBe(at(10));
    expect(nextChangeAt(day, at(10, 45), 15)).toBe(at(13, 45));
  });

  it("writes a window as a time range", () => {
    expect(formatWindow({ start: at(9), end: at(10, 30) })).toBe(
      "09:00–10:30",
    );
    expect(formatWindow({ start: at(23, 30), end: at(24, 15) })).toBe(
      "23:30–00:15",
    );
  });
});

describe("soonAppointment: an appointment named ahead", () => {
  const dentist = todo({ todoId: 5, title: "Zahnarzt", timeOfDay: "15:30" });
  const day = planner([todo(), dentist]);

  it("names nothing until fifteen minutes before the start", () => {
    expect(soonAppointment(arrangeToday(day, at(15, 14)), at(15, 14))).toBe(
      null,
    );
    const soon = soonAppointment(arrangeToday(day, at(15, 15)), at(15, 15));
    expect(soon).toMatchObject({ kind: "item", time: "15:30" });
  });

  it("leaves it to the turn rule once it begins", () => {
    const agenda = arrangeToday(day, at(15, 30));
    expect(agenda.focus).toBe(dentist);
    expect(soonAppointment(agenda, at(15, 30))).toBeNull();
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
