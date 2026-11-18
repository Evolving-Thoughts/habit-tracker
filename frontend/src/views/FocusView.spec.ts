import {
  NO_QUEST_HOURS,
  PLANNER_HABIT_FIELDS,
  PLANNER_TODO_FIELDS,
} from "../types/fixtures";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getToday,
  reorderDay,
  updateOccurrenceStatus,
  updateTodoCompletion,
} from "../api/day-planner.api";
import { createTimerController, timerKey } from "../composables/useTimer";
import type {
  DayPlannerHabitItem,
  DayPlannerResponse,
  DayPlannerTodoItem,
} from "../types/day-planner";
import type { Timer } from "../types/timer";
import FocusView from "./FocusView.vue";

vi.mock("../api/day-planner.api", () => ({
  getToday: vi.fn(),
  reorderDay: vi.fn(),
  updateOccurrenceStatus: vi.fn(),
  updateTodoCompletion: vi.fn(),
}));
vi.mock("../api/timers.api", () => ({
  getCurrentTimer: vi.fn(),
  startTimer: vi.fn(),
  timerAction: vi.fn(),
  changeTimerTarget: vi.fn(),
}));

vi.mock("../components/QuestNotes.vue", () => import("../test/quest-notes-stub"));

enableAutoUnmount(afterEach);

const todo = (
  overrides: Partial<DayPlannerTodoItem> = {},
): DayPlannerTodoItem => ({
  ...PLANNER_TODO_FIELDS,
  type: "todo",
  todoId: 1,
  title: "Kapitel schreiben",
  status: "pending",
  scheduledDate: "2026-10-02",
  completedAt: null,
  plannedDurationMinutes: 30,
  isOverdue: false,
  timerEligible: true,
  ...overrides,
});
const habit = (
  overrides: Partial<DayPlannerHabitItem> = {},
): DayPlannerHabitItem => ({
  ...PLANNER_HABIT_FIELDS,
  type: "habit",
  occurrenceId: 20,
  habitId: 10,
  title: "Lesen",
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
  workedMinutes = 0,
): DayPlannerResponse => ({
  date: "2026-10-02",
  items,
  externalEvents: [],
  workedMinutes,
  questHours: NO_QUEST_HOURS,
});
const stopwatch = (overrides: Partial<Timer> = {}): Timer => ({
  id: "t",
  kind: "todo",
  targetId: 1,
  title: "Kapitel schreiben",
  state: "running",
  elapsedMilliseconds: 0,
  targetMinutes: 30,
  targetReachedAt: null,
  ...overrides,
});

/** Mounts the view with a stopwatch controller whose server calls are spied on. */
async function mountView(running: Timer | null = null) {
  const controller = createTimerController();
  controller.timer.value = running;
  const start = vi.spyOn(controller, "start").mockResolvedValue();
  const action = vi.spyOn(controller, "action").mockResolvedValue(true);
  vi.spyOn(controller, "refresh").mockResolvedValue();
  const wrapper = mount(FocusView, {
    attachTo: document.body,
    global: { provide: { [timerKey as symbol]: controller } },
  });
  await flushPromises();
  const button = (label: string) =>
    wrapper.findAll("button").find((entry) => entry.text() === label)!;
  return { wrapper, controller, start, action, button };
}

describe("FocusView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // 08:00 in Berlin.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T06:00:00Z"));
    vi.mocked(updateTodoCompletion).mockResolvedValue(undefined);
    vi.mocked(updateOccurrenceStatus).mockResolvedValue(undefined);
    vi.mocked(reorderDay).mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it("shows the notes of the quest in view, and none for a daily", async () => {
    vi.mocked(getToday).mockResolvedValue(
      planner([todo({ todoId: 4 }), habit()]),
    );
    const { wrapper, button } = await mountView();
    expect(wrapper.get("[data-notes]").attributes("data-notes")).toBe("4");

    vi.mocked(getToday).mockResolvedValue(planner([habit()]));
    await button("Erledigt").trigger("click");
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("Lesen");
    expect(wrapper.find("[data-notes]").exists()).toBe(false);
  });

  it("shows only what is up now: its campaign, why, and a stopwatch ready to start", async () => {
    vi.mocked(getToday).mockResolvedValue(
      planner([
        todo({
          why: "Mein Wissen weitergeben",
          campaign: {
            id: 9,
            title: "Buch schreiben",
            color: null,
            icon: null,
          },
          workedMinutes: 12,
        }),
        todo({ todoId: 2, title: "Einkaufen" }),
        todo({ todoId: 3, title: "Zahnarzt", timeOfDay: "14:00" }),
      ]),
    );
    const { wrapper, start, button } = await mountView();

    expect(wrapper.get("h1").text()).toBe("Kapitel schreiben");
    expect(wrapper.get(".focus-view__campaign").text()).toBe("Buch schreiben");
    expect(wrapper.get(".focus-view__why").text()).toBe(
      "Mein Wissen weitergeben",
    );
    expect(wrapper.get('[role="timer"]').text()).toBe("00:00");
    expect(wrapper.get(".focus-view__state").text()).toContain("Bereit");
    expect(wrapper.get(".focus-view__state").text()).toContain("Soll 30 Min.");
    expect(wrapper.get(".focus-view__state").text()).toContain(
      "heute schon 12 Min.",
    );
    // The rest of the day is only named, never listed.
    expect(wrapper.get(".focus-view__ahead").text()).toContain("Einkaufen");
    expect(wrapper.get(".focus-view__ahead").text()).toContain(
      "14:00 Zahnarzt",
    );
    expect(wrapper.findAll("h1")).toHaveLength(1);

    await button("Starten").trigger("click");
    expect(start).toHaveBeenCalledWith({
      kind: "todo",
      targetId: 1,
      title: "Kapitel schreiben",
    });
  });

  it("counts up while the stopwatch runs and pauses or resumes it", async () => {
    vi.mocked(getToday).mockResolvedValue(planner([todo()]));
    const { wrapper, controller, action, button } = await mountView(
      stopwatch(),
    );
    expect(wrapper.get(".focus-view__state").text()).toContain("Läuft");
    await button("Pausieren").trigger("click");
    expect(action).toHaveBeenCalledWith("pause");

    controller.timer.value = stopwatch({ state: "paused" });
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".focus-view__state").text()).toContain("Pausiert");
    await button("Weiter").trigger("click");
    expect(action).toHaveBeenLastCalledWith("resume");
  });

  it("keeps what the stopwatch runs on in view, even if it is not first in the order", async () => {
    vi.mocked(getToday).mockResolvedValue(
      planner([todo(), todo({ todoId: 2, title: "Einkaufen" })]),
    );
    const { wrapper } = await mountView(
      stopwatch({ targetId: 2, title: "Einkaufen" }),
    );
    expect(wrapper.get("h1").text()).toBe("Einkaufen");
    expect(wrapper.get(".focus-view__ahead").text()).toContain(
      "Kapitel schreiben",
    );
  });

  it("completes the quest and brings up the next one", async () => {
    const second = todo({ todoId: 2, title: "Einkaufen" });
    vi.mocked(getToday)
      .mockResolvedValueOnce(planner([todo(), second]))
      .mockResolvedValue(
        planner([
          todo({ status: "completed", completedAt: "2026-10-02T06:00:00Z" }),
          second,
        ]),
      );
    const { wrapper, controller } = await mountView();

    await wrapper
      .get('button[aria-label="Kapitel schreiben erledigen"]')
      .trigger("click");
    await flushPromises();

    expect(updateTodoCompletion).toHaveBeenCalledWith(1, true);
    expect(controller.refresh).toHaveBeenCalled();
    expect(wrapper.get("h1").text()).toBe("Einkaufen");
  });

  it("puts a quest behind the rest of the order and ends its stopwatch", async () => {
    const first = todo();
    const second = todo({ todoId: 2, title: "Einkaufen" });
    const third = habit();
    vi.mocked(getToday)
      .mockResolvedValueOnce(planner([first, second, third]))
      .mockResolvedValue(planner([second, third, first]));
    const { wrapper, controller, action, button } = await mountView(
      stopwatch(),
    );
    // As on the server: a stopped stopwatch is gone.
    action.mockImplementation((kind) => {
      if (kind === "stop") controller.timer.value = null;
      return Promise.resolve(true);
    });

    await button("Später").trigger("click");
    await flushPromises();

    expect(action).toHaveBeenCalledWith("stop");
    expect(reorderDay).toHaveBeenCalledWith([
      { type: "todo", id: 2 },
      { type: "habit", id: 20 },
      { type: "todo", id: 1 },
    ]);
    expect(wrapper.get("h1").text()).toBe("Einkaufen");
  });

  it("offers no 'Später' for an appointment or the only open quest, and skipping only for a daily", async () => {
    vi.mocked(getToday).mockResolvedValue(planner([habit()]));
    const { wrapper, button } = await mountView();
    expect(button("Später")).toBeUndefined();
    await wrapper
      .get('button[aria-label="Lesen überspringen"]')
      .trigger("click");
    await flushPromises();
    expect(updateOccurrenceStatus).toHaveBeenCalledWith(20, "skipped");
  });

  it("starts and pauses with Space and completes with Ctrl+Enter", async () => {
    vi.mocked(getToday).mockResolvedValue(planner([todo()]));
    const { start } = await mountView();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    expect(start).toHaveBeenCalledTimes(1);
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true }),
    );
    await flushPromises();
    expect(updateTodoCompletion).toHaveBeenCalledWith(1, true);
  });

  it("says so when everything is done and leads back to Heute", async () => {
    vi.mocked(getToday).mockResolvedValue(
      planner(
        [todo({ status: "completed", completedAt: "2026-10-02T06:00:00Z" })],
        95,
      ),
    );
    const { wrapper } = await mountView();
    expect(wrapper.get("h1").text()).toBe("Alles erledigt");
    expect(wrapper.text()).toContain("Du hast 1 Std. 35 Min. gearbeitet.");
    expect(wrapper.get("a.btn").attributes("href")).toBe("#/heute");
    expect(wrapper.find('[role="timer"]').exists()).toBe(false);
  });

  it("says why an action failed and keeps the quest in view", async () => {
    vi.mocked(getToday).mockResolvedValue(planner([todo()]));
    vi.mocked(updateTodoCompletion).mockRejectedValueOnce(new Error("Offline"));
    const { wrapper } = await mountView();
    await wrapper
      .get('button[aria-label="Kapitel schreiben erledigen"]')
      .trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("Offline");
    expect(wrapper.get("h1").text()).toBe("Kapitel schreiben");
  });
});
