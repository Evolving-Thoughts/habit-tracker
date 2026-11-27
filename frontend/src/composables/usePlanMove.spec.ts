import { computed, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  reorderBacklog,
  reorderDay,
  rescheduleOccurrence,
  rescheduleTodo,
} from "../api/day-planner.api";
import { planQuest, unplanQuest } from "../api/questlog.api";
import { WEEK_ENTRY_FIELDS, WEEK_HABIT_FIELDS } from "../types/fixtures";
import type {
  WeekPlanDay,
  WeekPlanEntry,
  WeekPlanResponse,
  WeekPlanTodoEntry,
} from "../types/week-plan";
import type { QuestlogQuest } from "../utils/week-plan";
import { usePlanMove } from "./usePlanMove";
import { useWrites } from "./useWrites";

/* The fake API: every write the move sends, in the order it arrives. */
const sent = vi.hoisted(() => [] as string[]);
vi.mock("../api/day-planner.api", () => ({
  reorderDay: vi.fn(async () => void sent.push("reorderDay")),
  reorderBacklog: vi.fn(async () => void sent.push("reorderBacklog")),
  rescheduleTodo: vi.fn(async () => void sent.push("rescheduleTodo")),
  rescheduleOccurrence: vi.fn(async () => void sent.push("rescheduleOccurrence")),
  updateTodoCompletion: vi.fn(),
  updateOccurrenceStatus: vi.fn(),
}));
vi.mock("../api/questlog.api", () => ({
  planQuest: vi.fn(async () => void sent.push("planQuest")),
  unplanQuest: vi.fn(async () => void sent.push("unplanQuest")),
}));

const TODAY = "2026-11-17";
const WEDNESDAY = "2026-11-18";

const quest = (
  todoId: number,
  overrides: Partial<WeekPlanTodoEntry> = {},
): WeekPlanTodoEntry => ({
  ...WEEK_ENTRY_FIELDS,
  type: "todo",
  todoId,
  title: `Quest ${todoId}`,
  status: "pending",
  scheduledDate: TODAY,
  ...overrides,
});

const run = (): WeekPlanEntry => ({
  ...WEEK_ENTRY_FIELDS,
  ...WEEK_HABIT_FIELDS,
  type: "habit",
  habitId: 5,
  occurrenceId: 9,
  title: "Laufen",
  status: "pending",
  moveUntil: TODAY,
});

function board(days: Record<string, WeekPlanDay["entries"]>): WeekPlanResponse {
  const dates = [TODAY, WEDNESDAY];
  return {
    startDate: TODAY,
    endDate: WEDNESDAY,
    today: TODAY,
    days: dates.map((date) => ({ date, entries: days[date] ?? [] })),
    overdue: [],
  };
}

const queued = (id: number): QuestlogQuest => ({
  id,
  title: `Questlog ${id}`,
  plannedDurationMinutes: null,
  campaign: null,
  timerEligible: true,
});

function harness(plan: WeekPlanResponse, backlog: QuestlogQuest[] = []) {
  const state = { plan: ref<WeekPlanResponse | null>(plan), backlog: ref(backlog) };
  const errorMessage = ref<string | null>(null);
  const reload = vi.fn(async () => {});
  const writes = useWrites(reload, errorMessage);
  const lines: string[] = [];
  const refused: string[] = [];
  const moves = usePlanMove(state, writes, {
    key: "plan",
    words: "plan",
    said: (line) => lines.push(line),
    refused: (line) => refused.push(line),
  });
  return { ...state, errorMessage, reload, lines, refused, ...moves };
}

const titles = (plan: WeekPlanResponse | null, date: string) =>
  plan!.days.find((day) => day.date === date)!.entries.map(({ title }) => title);

describe("usePlanMove", () => {
  beforeEach(() => {
    sent.length = 0;
    vi.clearAllMocks();
  });

  it("shows a move at once, then sends its writes in order and reloads", async () => {
    const { plan, lines, reload, move } = harness(
      board({ [TODAY]: [quest(1), quest(2)], [WEDNESDAY]: [quest(3, { scheduledDate: WEDNESDAY })] }),
    );
    const done = move({ kind: "day", drop: { todoId: 2, toDate: WEDNESDAY, index: 0 } });
    // Before the server answers.
    expect(titles(plan.value, WEDNESDAY)).toEqual(["Quest 2", "Quest 3"]);
    expect(lines).toEqual(["„Quest 2“ steht jetzt am Mittwoch, 18. Nov."]);
    expect(await done).toBe(true);
    expect(sent).toEqual(["rescheduleTodo", "reorderDay"]);
    expect(rescheduleTodo).toHaveBeenCalledWith(2, WEDNESDAY, false);
    expect(reorderDay).toHaveBeenCalledWith([
      { type: "todo", id: 2 },
      { type: "todo", id: 3 },
    ]);
    expect(reload).toHaveBeenCalled();
  });

  it("plans a quest of the Questlog column and takes it out of the column", async () => {
    const { backlog, move } = harness(board({}), [queued(7), queued(8)]);
    expect(
      await move({ kind: "day", drop: { todoId: 7, toDate: WEDNESDAY, index: 0 } }),
    ).toBe(true);
    expect(sent).toEqual(["planQuest", "reorderDay"]);
    expect(planQuest).toHaveBeenCalledWith(queued(7), WEDNESDAY);
    expect(backlog.value.map(({ id }) => id)).toEqual([8]);
  });

  it("takes a quest off its day into the column, then stores the column's order", async () => {
    const { backlog, plan, move } = harness(board({ [TODAY]: [quest(5)] }), [queued(1)]);
    expect(await move({ kind: "questlog", drop: { todoId: 5, index: 0 } })).toBe(true);
    expect(sent).toEqual(["unplanQuest", "reorderBacklog"]);
    expect(unplanQuest).toHaveBeenCalledWith(5);
    expect(reorderBacklog).toHaveBeenCalledWith([5, 1]);
    expect(backlog.value.map(({ id }) => id)).toEqual([5, 1]);
    expect(titles(plan.value, TODAY)).toEqual([]);
  });

  it("takes the shown result back when a write fails, and stops there", async () => {
    vi.mocked(planQuest).mockRejectedValueOnce(new Error("Der Server ist weg."));
    const before = board({ [WEDNESDAY]: [quest(3, { scheduledDate: WEDNESDAY })] });
    const { plan, backlog, lines, errorMessage, move } = harness(before, [queued(7)]);
    const column = backlog.value;
    expect(
      await move({ kind: "day", drop: { todoId: 7, toDate: WEDNESDAY, index: 0 } }),
    ).toBe(false);
    expect(reorderDay).not.toHaveBeenCalled();
    expect(plan.value).toEqual(before);
    expect(backlog.value).toBe(column);
    expect(lines.at(-1)).toBe("");
    expect(errorMessage.value).toBe("Der Server ist weg.");
  });

  it("uses the move's own error text when the server gives none", async () => {
    vi.mocked(rescheduleOccurrence).mockRejectedValueOnce("nope");
    const { errorMessage, move } = harness(
      board({ [TODAY]: [{ ...run(), moveUntil: WEDNESDAY } as WeekPlanEntry] }),
    );
    await move({ kind: "run", drop: { occurrenceId: 9, toDate: WEDNESDAY, index: 0 } });
    expect(errorMessage.value).toBe("Das Daily konnte nicht verschoben werden.");
  });

  it("only says why when a move may not land, and writes nothing", async () => {
    const start = board({ [TODAY]: [run()] });
    const { plan, refused, lines, move } = harness(start);
    expect(
      await move({ kind: "run", drop: { occurrenceId: 9, toDate: WEDNESDAY, index: 0 } }),
    ).toBe(false);
    expect(refused).toEqual(["„Laufen“ kann höchstens bis Dienstag, 17. Nov. warten."]);
    expect(lines).toEqual([]);
    expect(plan.value).toEqual(start);
    expect(sent).toEqual([]);
  });

  it("starts nothing while another write runs", async () => {
    const plan = ref<WeekPlanResponse | null>(board({ [TODAY]: [quest(1), quest(2)] }));
    const writeShown = vi.fn();
    const { move } = usePlanMove(
      { plan },
      { busy: computed(() => true), writeShown },
      { key: "day", words: "day", said: () => {}, refused: () => {} },
    );
    expect(
      await move({ kind: "day", drop: { todoId: 2, toDate: TODAY, index: 0 } }),
    ).toBe(false);
    expect(writeShown).not.toHaveBeenCalled();
  });

  it("steps an entry within the shown days, and a run sideways only within its window", async () => {
    const shown = board({ [TODAY]: [quest(1), run()] });
    const { refused, step } = harness(shown);
    expect(await step(shown.days[0]!.entries[1]!, "right", shown)).toBe(false);
    expect(refused).toEqual(["„Laufen“ kann höchstens bis Dienstag, 17. Nov. warten."]);
    expect(await step(shown.days[0]!.entries[1]!, "up", shown)).toBe(true);
    expect(reorderDay).toHaveBeenCalledWith([
      { type: "habit", id: 9 },
      { type: "todo", id: 1 },
    ]);
    // An event or a done entry takes no steps.
    expect(await step(quest(4, { status: "completed" }), "up", shown)).toBe(false);
  });
});
