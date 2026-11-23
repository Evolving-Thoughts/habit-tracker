import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import {
  rescheduleOccurrence,
  rescheduleTodo,
  updateOccurrenceStatus,
  updateTodoCompletion,
} from "../api/day-planner.api";
import { getTodoHierarchy } from "../api/todo-hierarchy.api";
import { useTicks, type TickTarget } from "./useTicks";

vi.mock("../api/day-planner.api", () => ({
  rescheduleOccurrence: vi.fn(),
  rescheduleTodo: vi.fn(),
  updateOccurrenceStatus: vi.fn(),
  updateTodoCompletion: vi.fn(),
}));
vi.mock("../api/todo-hierarchy.api", () => ({ getTodoHierarchy: vi.fn() }));

const quest: TickTarget = { kind: "todo", id: 7, title: "Steuer" };
const run: TickTarget = { kind: "occurrence", id: 3, title: "Laufen" };

type Write = Parameters<typeof useTicks>[0];

function setup(onOtherUndo?: (held: { kind: "log"; id: number }) => void) {
  const calls: { key?: string; fallbackError: string }[] = [];
  let failing = false;
  const write: Write = async (action, options) => {
    calls.push(options);
    if (failing) return false;
    await action();
    return true;
  };
  let api!: ReturnType<typeof useTicks>;
  mount(
    defineComponent({
      setup() {
        api = useTicks(write, { onOtherUndo });
        return () => h("div");
      },
    }),
  );
  return { api, calls, fail: () => (failing = true) };
}

describe("useTicks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("completes a quest and a run through their own endpoints", async () => {
    const { api } = setup();
    expect(await api.complete(quest, { key: "q" })).toBe(true);
    expect(updateTodoCompletion).toHaveBeenCalledWith(7, true);
    expect(await api.complete(run)).toBe(true);
    expect(updateOccurrenceStatus).toHaveBeenCalledWith(3, "completed");
  });

  it("offers the undo, and taking it opens the target again", async () => {
    const { api, calls } = setup();
    const onUndone = vi.fn();
    await api.complete(run, { key: "row-3", onUndone });
    expect(api.undo.value?.label).toBe("„Laufen“ erledigt");
    await api.undoLast();
    expect(updateOccurrenceStatus).toHaveBeenLastCalledWith(3, "pending");
    expect(calls.at(-1)).toEqual({
      key: "row-3",
      fallbackError: "Das Rückgängigmachen hat nicht geklappt.",
    });
    expect(onUndone).toHaveBeenCalledTimes(1);
    expect(api.undo.value).toBeNull();
  });

  it("offers no undo when the write failed", async () => {
    const { api, fail } = setup();
    fail();
    expect(await api.complete(quest)).toBe(false);
    expect(api.undo.value).toBeNull();
  });

  it("asks before a campaign with open quests and stops on no", async () => {
    const { api } = setup();
    const onConfirmed = vi.fn();
    const pending = api.complete(quest, { campaign: 2, onConfirmed });
    await Promise.resolve();
    expect(api.campaignQuestion.value).toEqual({ title: "Steuer", open: 2 });
    api.answerCampaign(false);
    expect(await pending).toBe(false);
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(updateTodoCompletion).not.toHaveBeenCalled();
  });

  it("looks the open quests up and says “abgeschlossen” after a yes", async () => {
    vi.mocked(getTodoHierarchy).mockResolvedValue([
      { id: 7, progress: { todoCount: 3, doneCount: 1 } },
    ] as never);
    const { api } = setup();
    const pending = api.complete(quest, { campaign: "lookup" });
    await vi.waitFor(() => expect(api.campaignQuestion.value).not.toBeNull());
    api.answerCampaign(true);
    expect(await pending).toBe(true);
    expect(api.undo.value?.label).toBe("„Steuer“ abgeschlossen");
  });

  it("goes ahead at once for a campaign without open quests", async () => {
    const { api } = setup();
    expect(await api.complete(quest, { campaign: 0 })).toBe(true);
    expect(api.campaignQuestion.value).toBeNull();
  });

  it("reopens without a toast, skips and moves by kind", async () => {
    const { api, calls } = setup();
    await api.reopen(quest);
    expect(updateTodoCompletion).toHaveBeenCalledWith(7, false);
    expect(api.undo.value).toBeNull();
    await api.skip(run, "row-3");
    expect(updateOccurrenceStatus).toHaveBeenCalledWith(3, "skipped");
    await api.move(quest, "2026-11-24");
    expect(rescheduleTodo).toHaveBeenCalledWith(7, "2026-11-24", false);
    await api.move(run, "2026-11-24");
    expect(rescheduleOccurrence).toHaveBeenCalledWith(3, "2026-11-24");
    expect(calls.at(-1)?.fallbackError).toBe(
      "Das Daily konnte nicht verschoben werden.",
    );
  });

  it("hands another held step back to the view", async () => {
    const onOtherUndo = vi.fn();
    const { api } = setup(onOtherUndo);
    api.offerUndo({ kind: "log", id: 9 }, "Abschnitt gelöscht", vi.fn());
    await api.undoLast();
    expect(onOtherUndo).toHaveBeenCalledWith({ kind: "log", id: 9 });
    expect(updateTodoCompletion).not.toHaveBeenCalled();
  });
});
