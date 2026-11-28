import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ref } from "vue";
import { planQuest } from "../api/questlog.api";
import type {
  ActionRow,
  QuestRow,
  RunRow,
} from "../utils/row-actions";
import { useRowActions, type RowCall } from "./useRowActions";
import type { TimerController } from "./useTimer";

vi.mock("../api/questlog.api", () => ({ planQuest: vi.fn() }));

// 18 Nov 2026 is a Wednesday; next week's Monday is the 23rd.
const TODAY = "2026-11-18";
const TOMORROW = "2026-11-19";
const NEXT_WEEK = "2026-11-23";

const quest = (changes: Partial<QuestRow> = {}): QuestRow => ({
  type: "quest",
  todoId: 3,
  title: "Lesen",
  open: true,
  date: TODAY,
  timeOfDay: null,
  plannedDurationMinutes: 25,
  timerEligible: true,
  campaign: false,
  ...changes,
});
const run = (changes: Partial<RunRow> = {}): RunRow => ({
  type: "run",
  occurrenceId: 7,
  habitId: 2,
  title: "Joggen",
  open: true,
  date: TODAY,
  moveUntil: "2026-11-25",
  timerEligible: true,
  monthChallenge: false,
  ...changes,
});
const QUEST = { kind: "todo", targetId: 3, title: "Lesen" } as const;
const RUN = { kind: "occurrence", targetId: 7, title: "Joggen" } as const;

/** A view with every means, all fakes: what runs is the composable's choice alone. */
function view(
  changes: Partial<Parameters<typeof useRowActions>[0]> = {},
  { writing = [] as string[] } = {},
) {
  const ticks = {
    complete: vi.fn(async () => true),
    reopen: vi.fn(async () => true),
    skip: vi.fn(async () => true),
    move: vi.fn(async () => true),
  };
  const session = {
    write: vi.fn(async (action: () => Promise<unknown>) => {
      await action();
      return true;
    }),
    isWriting: vi.fn((key: string) => writing.includes(key)),
  };
  const focus = {
    around: vi.fn(async (_key: string, action: () => Promise<unknown>) => {
      await action();
    }),
  };
  const dialogs = {
    edit: vi.fn(),
    pickDay: vi.fn(),
    reparent: vi.fn(),
    remove: vi.fn(),
    busy: ref(false),
  };
  const timer = {
    timer: ref(null),
    busy: ref(false),
    start: vi.fn(),
    action: vi.fn(),
  } as unknown as TimerController & { start: Mock };
  const said = vi.fn();
  const actions = useRowActions({
    today: () => TODAY,
    session,
    ticks,
    focus,
    dialogs,
    timer,
    said,
    ...changes,
  });
  return { actions, ticks, session, focus, dialogs, timer, said };
}

const call = (row: ActionRow, changes: Partial<RowCall> = {}): RowCall => ({
  key: "row-1",
  row,
  ...changes,
});

beforeEach(() => {
  vi.mocked(planQuest).mockReset().mockResolvedValue({} as never);
});

describe("useRowActions: each step takes its path", () => {
  it.each<[string, ActionRow, unknown]>([
    ["a quest", quest(), [QUEST, { key: "row-1", campaign: undefined }]],
    [
      "a quest that is itself a campaign, which asks first",
      quest({ campaign: true }),
      [QUEST, { key: "row-1", campaign: "lookup" }],
    ],
    ["a run", run(), [RUN, { key: "row-1", campaign: undefined }]],
  ])("completes %s through useTicks, inside the focus wrap", async (_name, row, args) => {
    const { actions, ticks, focus } = view();
    actions.of(call(row)).complete!();
    await flushPromises();
    expect(focus.around).toHaveBeenCalledWith("row-1", expect.any(Function));
    expect(ticks.complete).toHaveBeenCalledWith(
      ...(args as [unknown, unknown]).map((arg, index) =>
        index ? expect.objectContaining(arg as object) : arg,
      ),
    );
  });

  it("ticks with the ring: done when open, open again when done, no focus wrap", async () => {
    const { actions, ticks, focus } = view();
    await actions.tick(call(quest()));
    expect(ticks.complete).toHaveBeenCalledTimes(1);
    await actions.tick(call(quest({ open: false })));
    expect(ticks.reopen).toHaveBeenCalledWith(QUEST, { key: "row-1" });
    expect(focus.around).not.toHaveBeenCalled();
  });

  it("tells the view a tick went through, and when it was taken back", async () => {
    const { actions, ticks } = view();
    const ticked = vi.fn();
    await actions.tick(call(quest(), { ticked }));
    expect(ticked).toHaveBeenLastCalledWith(true);
    const [, options] = ticks.complete.mock.calls[0] as unknown as [
      unknown,
      { onUndone: () => void },
    ];
    options.onUndone();
    expect(ticked).toHaveBeenLastCalledWith(false);
    await actions.tick(call(quest({ open: false }), { ticked }));
    expect(ticked).toHaveBeenCalledTimes(3);
    expect(ticked).toHaveBeenLastCalledWith(false);
  });

  it("skips a run and says so", async () => {
    const { actions, ticks, focus, said } = view();
    actions.of(call(run())).skip!();
    await flushPromises();
    expect(focus.around).toHaveBeenCalledWith("row-1", expect.any(Function));
    expect(ticks.skip).toHaveBeenCalledWith(RUN, "row-1");
    expect(said).toHaveBeenCalledWith("„Joggen“ übersprungen.");
  });

  /* The status line says where the row stands now, in Heute's words. */
  it.each<[string, ActionRow, string, string, string]>([
    ["a quest", quest({ date: "2026-11-16" }), TODAY, "reschedule", "„Lesen“ steht jetzt bei heute."],
    ["a quest", quest(), TOMORROW, "reschedule", "„Lesen“ steht jetzt bei morgen."],
    ["a run", run(), NEXT_WEEK, "reschedule", "„Joggen“ steht jetzt am Montag, 23. Nov."],
    ["a quest without a day", quest({ date: null }), TOMORROW, "plan", "„Lesen“ steht jetzt bei morgen."],
  ])("moves %s to %s by %s", async (_name, row, date, path, line) => {
    const { actions, ticks, focus, said } = view();
    expect(actions.of(call(row)).move!(date)).toBe(true);
    await flushPromises();
    expect(focus.around).toHaveBeenCalledWith("row-1", expect.any(Function));
    if (path === "plan") {
      expect(planQuest).toHaveBeenCalledWith(
        { id: 3, title: "Lesen", plannedDurationMinutes: 25 },
        date,
      );
      expect(ticks.move).not.toHaveBeenCalled();
    } else {
      expect(ticks.move).toHaveBeenCalledWith(
        row.type === "run" ? RUN : QUEST,
        date,
        { key: "row-1" },
      );
    }
    expect(said).toHaveBeenCalledWith(line);
  });

  it("says nothing when a move fails", async () => {
    const { actions, ticks, said } = view();
    ticks.move.mockResolvedValue(false);
    actions.of(call(quest())).move!(TOMORROW);
    await flushPromises();
    expect(said).not.toHaveBeenCalled();
  });

  it("goes the view's own way onto a day it has one for", async () => {
    const own = vi.fn(async () => {});
    const moveWithin = vi.fn((_row: QuestRow | RunRow, date: string) =>
      date === TOMORROW ? own : null,
    );
    const { actions, ticks, said } = view({ moveWithin });
    actions.of(call(quest())).move!(TOMORROW);
    await flushPromises();
    expect(moveWithin).toHaveBeenCalledWith(quest(), TOMORROW);
    expect(own).toHaveBeenCalled();
    expect(ticks.move).not.toHaveBeenCalled();
    expect(said).not.toHaveBeenCalled();
    actions.of(call(quest())).move!(NEXT_WEEK);
    await flushPromises();
    expect(ticks.move).toHaveBeenCalledWith(QUEST, NEXT_WEEK, { key: "row-1" });
  });

  it.each<[string, ActionRow, string, unknown]>([
    [
      "a quest of today",
      quest(),
      "pickDay",
      [{ type: "todo", todoId: 3, title: "Lesen", timeOfDay: null }, { offerToday: false }],
    ],
    [
      "a run carried over, which may come back to today",
      run({ date: "2026-11-16" }),
      "pickDay",
      [
        { type: "habit", occurrenceId: 7, title: "Joggen", moveUntil: "2026-11-25" },
        { offerToday: true },
      ],
    ],
    [
      "a quest without a day, in its editor at the day field",
      quest({ date: null }),
      "edit",
      [{ kind: "todo", id: 3, focus: 'input[name="scheduledDate"]' }],
    ],
  ])("picks another day for %s", (_name, row, dialog, args) => {
    const { actions, dialogs } = view();
    actions.of(call(row)).pickDay!();
    expect(dialogs[dialog as "pickDay" | "edit"]).toHaveBeenCalledWith(
      "row-1",
      ...(args as unknown[]),
    );
  });

  it.each<[string, ActionRow, unknown, unknown]>([
    ["a quest", quest(), { kind: "todo", id: 3 }, { kind: "todo", id: 3, title: "Lesen" }],
    [
      "a campaign",
      quest({ campaign: true }),
      { kind: "todo", id: 3, campaign: true },
      { kind: "todo", id: 3, title: "Lesen", campaign: true },
    ],
    [
      "a run, whose daily it is",
      run(),
      { kind: "habit", id: 2, occurrenceId: 7 },
      { kind: "habit", id: 2, title: "Joggen" },
    ],
    [
      "a forecast run",
      { type: "forecast", habitId: 2, title: "Joggen", open: true },
      { kind: "habit", id: 2, occurrenceId: null },
      { kind: "habit", id: 2, title: "Joggen" },
    ],
  ])("opens the editor and Löschen of %s", (_name, row, editTarget, deleteTarget) => {
    const { actions, dialogs } = view();
    const steps = actions.of(call(row));
    steps.edit!();
    steps.remove!();
    expect(dialogs.edit).toHaveBeenCalledWith("row-1", editTarget);
    expect(dialogs.remove).toHaveBeenCalledWith("row-1", deleteTarget);
  });

  it("moves a quest into a campaign, and nothing of an event", () => {
    const { actions, dialogs } = view();
    actions.of(call(quest())).reparent!();
    expect(dialogs.reparent).toHaveBeenCalledWith("row-1", {
      todoId: 3,
      title: "Lesen",
    });
    expect(
      actions.menu(call({ type: "event", title: "Zahnarzt", open: true })),
    ).toEqual([]);
  });

  it("puts the stopwatch in the menu of a card without ▶ only", () => {
    const { actions, timer } = view();
    const labels = (changes: Partial<RowCall>) =>
      actions.menu(call(quest(), changes)).map((entry) => entry.label);
    expect(labels({})).not.toContain("Stoppuhr starten");
    const entry = actions
      .menu(call(quest(), { menuTimer: true }))
      .find((item) => item.id === "timer")!;
    entry.run();
    expect(timer.start).toHaveBeenCalledWith(QUEST);
  });
});

describe("useRowActions: what the view has", () => {
  it("offers no tick, skip or move without ticks, and no dialog without dialogs", () => {
    const steps = view({ ticks: undefined }).actions.of(call(run()));
    expect([steps.complete, steps.skip, steps.move, steps.pickDay]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(steps.edit).toBeDefined();
    const bare = view({ dialogs: undefined }).actions.of(call(quest()));
    expect([bare.edit, bare.pickDay, bare.reparent, bare.remove]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("hands over the view's own steps, and the board's column steps in place of the plain ones", () => {
    const step = () => undefined;
    const focusMode = vi.fn();
    const move = vi.fn();
    const steps = view().actions.of(
      call(quest(), { step, focusMode, boardSteps: { move } }),
    );
    expect(steps.step).toBe(step);
    expect(steps.focusMode).toBe(focusMode);
    expect(steps.move).toBe(move);
  });
});

describe("useRowActions: a busy row waits", () => {
  it.each<[string, Parameters<typeof view>]>([
    ["for the view's own reason", [{ busy: () => true }]],
    ["while a dialog saves", [{}]],
    ["while its own write runs", [{}, { writing: ["row-1"] }]],
    ["while the view's one write key runs", [{ writeKey: "plan" }, { writing: ["plan"] }]],
  ])("%s", async (name, args) => {
    const fakes = view(...args);
    if (name === "while a dialog saves") fakes.dialogs.busy.value = true;
    const { actions, ticks } = fakes;
    const steps = actions.of(call(quest()));
    expect(steps.busy).toBe(true);
    expect(await actions.tick(call(quest()))).toBe(false);
    expect(steps.move!(TOMORROW)).toBe(false);
    steps.complete!();
    actions.of(call(run())).skip!();
    await flushPromises();
    expect(ticks.complete).not.toHaveBeenCalled();
    expect(ticks.move).not.toHaveBeenCalled();
    expect(ticks.skip).not.toHaveBeenCalled();
    // Space as well: every key passes.
    const keys = actions.shortcuts(() => call(quest()));
    expect(keys["row.timer"]!({ row: null, key: "row-1" })).toBe(false);
    expect(fakes.timer.start).not.toHaveBeenCalled();
  });

  it("writes under the view's one key where it has one", async () => {
    const { actions, ticks } = view({ writeKey: "plan" });
    actions.of(call(quest())).move!(TOMORROW);
    await flushPromises();
    expect(ticks.move).toHaveBeenCalledWith(QUEST, TOMORROW, { key: "plan" });
  });

  it("starts the stopwatch with Space once the row is free", () => {
    const { actions, timer } = view();
    const keys = actions.shortcuts(() => call(quest()));
    expect(keys["row.timer"]!({ row: null, key: "row-1" })).toBe(true);
    expect(timer.start).toHaveBeenCalledWith(QUEST);
  });
});
