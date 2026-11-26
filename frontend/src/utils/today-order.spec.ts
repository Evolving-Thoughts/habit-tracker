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
import type { MonthChallenge } from "../types/month-challenge";
import { arrangeToday } from "./today-agenda";
import {
  dropInDay,
  orderRef,
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

/* The Monats-Challenge's run (occurrence 70), stored third; 20:00 is evening. */
const evening = 20 * 60;
const challengeRun = (dayPosition: number): DayPlannerHabitItem => ({
  ...PLANNER_HABIT_FIELDS,
  type: "habit",
  occurrenceId: 70,
  habitId: 7,
  title: "Sport",
  status: "pending",
  scheduledDate: "2026-10-02",
  plannedDurationMinutes: null,
  moveUntil: null,
  scheduleType: "interval",
  isOverdue: false,
  timerEligible: true,
  timeOfDay: null,
  dayPosition,
  monthChallenge: true,
});
const withChallenge = (
  items: DayPlannerResponse["items"],
): DayPlannerResponse => ({
  ...day(items),
  monthChallenge: {
    todayRun: "open",
    todayOccurrenceId: 70,
    reminderTime: null,
  } as MonthChallenge,
});

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

describe("the evening's challenge run in the order", () => {
  const planner = withChallenge([
    quest(1, 0),
    quest(2, 1),
    challengeRun(2),
    quest(4, 3),
  ]);
  const agenda = arrangeToday(planner, evening);

  it("stands second on screen while its stored place stays third", () => {
    const rows = sortableRows(agenda);
    expect(rows[1]).toBe(agenda.eveningChallenge);
    expect(ids(agenda.sequence.map(orderRef))).toEqual([1, 2, 70, 4]);
  });

  it("sorts by what is on screen when it is dragged or crossed", () => {
    // Dragged down to the end: stored there, shown below the focus while open.
    expect(ids(dropInDay(planner, agenda, 1, 3)!.order)).toEqual([1, 2, 4, 70]);
    // Dragged onto the focus card: it heads the day and becomes the focus.
    expect(ids(dropInDay(planner, agenda, 1, 0)!.order)).toEqual([70, 1, 2, 4]);
    // A row dragged up onto it lands right below it.
    expect(ids(dropInDay(planner, agenda, 3, 1)!.order)).toEqual([1, 4, 70, 2]);
  });

  it("only steps up, and the other rows step over it", () => {
    const [, run, second, last] = sortableRows(agenda);
    expect(stepInDay(agenda, run!, 1)).toBeNull();
    expect(stepInDay(agenda, run!, -1)).toBe(0);
    expect(stepInDay(agenda, second!, -1)).toBe(0);
    expect(stepInDay(agenda, last!, -1)).toBe(2);
  });
});

describe("the evening's challenge run carried over from an earlier day", () => {
  const earlier = { ...challengeRun(0), isOverdue: true, scheduledDate: "2026-10-01" };
  const planner = withChallenge([earlier, quest(1, 0), quest(2, 1)]);
  const agenda = arrangeToday(planner, evening);

  it("stands below the focus card but does not move", () => {
    const rows = sortableRows(agenda);
    expect(rows[1]).toBe(earlier);
    expect(dropInDay(planner, agenda, 1, 2)).toBeNull();
    expect(stepInDay(agenda, earlier, -1)).toBeNull();
    expect(stepInDay(agenda, earlier, 1)).toBeNull();
    // The rows below still step over it onto the focus card's place, and
    // the order written leaves it out.
    expect(stepInDay(agenda, rows[2]!, -1)).toBe(0);
    expect(ids(dropInDay(planner, agenda, 2, 0)!.order)).toEqual([2, 1]);
    // Dropped onto it alone, a row has crossed nothing with a place.
    expect(dropInDay(planner, agenda, 2, 1)).toBeNull();
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

describe("a Google event in the order of the day", () => {
  const event = (id: number, hour: number, dayPosition: number | null) => ({
    id,
    title: `E${id}`,
    start: `2026-10-02T${String(hour - 2).padStart(2, "0")}:00:00Z`,
    end: `2026-10-02T${String(hour - 1).padStart(2, "0")}:00:00Z`,
    dayPosition,
    done: false,
  });

  const names = (rows: ReturnType<typeof sortableRows>) =>
    rows.map((row) => ("event" in row ? row.event.title : row.title));

  it("keeps a card dropped next to it there", () => {
    // Berlin is UTC+2: the event is at 11:00. Never sorted, it heads the
    // list below the focus card.
    const planner = { ...day([quest(1, 0), quest(2, 1), quest(3, 2)]), externalEvents: [event(9, 11, null)] };
    const agenda = arrangeToday(planner, nine);
    expect(names(sortableRows(agenda))).toEqual(["Q1", "E9", "Q2", "Q3"]);
    // Q3 dragged up onto the event lands right above it.
    const move = dropInDay(planner, agenda, 3, 1)!;
    expect(move.order).toEqual([
      { type: "todo", id: 1 },
      { type: "todo", id: 3 },
      { type: "event", id: 9 },
      { type: "todo", id: 2 },
    ]);
    expect(move.message).toBe("„Q3“ steht jetzt an Stelle 2 von 3.");
    expect(move.planner.externalEvents[0]!.dayPosition).toBe(2);
    // Read back, it stays there.
    expect(names(sortableRows(arrangeToday(move.planner, nine)))).toEqual(["Q1", "Q3", "E9", "Q2"]);
  });

  it("drags itself among the cards without a time, never past an appointment", () => {
    // Q5 has a time (13:00); the event (11:00) stands before it.
    const planner = {
      ...day([quest(1, 0), quest(2, 2), quest(3, 3), quest(5, 4, "13:00")]),
      externalEvents: [event(9, 11, 1)],
    };
    const agenda = arrangeToday(planner, nine);
    expect(names(sortableRows(agenda))).toEqual(["Q1", "E9", "Q2", "Q3", "Q5"]);
    // Dragged down past Q2 and Q3, it lands right after them.
    const move = dropInDay(planner, agenda, 1, 3)!;
    expect(names(sortableRows(arrangeToday(move.planner, nine)))).toEqual(["Q1", "Q2", "Q3", "E9", "Q5"]);
    expect(move.message).toBe("„E9“ steht jetzt an Stelle 4 von 5.");
    // Past the 13:00 appointment it stops right before it.
    const far = dropInDay(planner, agenda, 1, 4)!;
    expect(names(sortableRows(arrangeToday(far.planner, nine)))).toEqual(["Q1", "Q2", "Q3", "E9", "Q5"]);
  });

  it("is stepped over by the keyboard", () => {
    const planner = { ...day([quest(1, 0), quest(2, 2)]), externalEvents: [event(9, 11, 1)] };
    const agenda = arrangeToday(planner, nine);
    const rows = sortableRows(agenda);
    expect(stepInDay(agenda, rows[1]!, -1)).toBeNull();
    expect(stepInDay(agenda, rows[2]!, -1)).toBe(0);
  });
});
