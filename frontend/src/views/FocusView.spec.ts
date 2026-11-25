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
import {
  createFocusBlockController,
  focusBlockKey,
} from "../composables/useFocusBlock";
import type {
  FocusBlockNative,
  FocusBlockNativeStatus,
} from "../native/focus-block-plugin";
import type { FocusBlockState } from "../types/focus-block";
import type {
  DayPlannerHabitItem,
  DayPlannerResponse,
  DayPlannerTodoItem,
} from "../types/day-planner";
import type { Timer } from "../types/timer";
import { listSounds } from "../api/sounds.api";
import type { Sound } from "../types/sound";
import { resetSoundCatalog } from "../composables/useFocusSound";
import {
  reloadFocusSoundSettings,
  updateFocusSound,
} from "../composables/useFocusSoundSettings";
import { updateSoundEffects } from "../composables/useSoundEffects";
import { getWeekReview } from "../api/week-review.api";
import type { WeekReviewResponse } from "../types/week-review";
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

vi.mock("../api/sounds.api", () => ({
  listSounds: vi.fn(),
  soundUrl: (sound: Sound) => `/api/sounds/${sound.id}?v=${sound.version}`,
}));

vi.mock("../api/week-review.api", () => ({ getWeekReview: vi.fn() }));

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
    vi.mocked(listSounds).mockResolvedValue([]);
    resetSoundCatalog();
    localStorage.clear();
    reloadFocusSoundSettings();
  });
  afterEach(() => vi.useRealTimers());

  it("shows the notes of the quest in view, then those of the daily run", async () => {
    vi.mocked(getToday).mockResolvedValue(
      planner([todo({ todoId: 4 }), habit()]),
    );
    const { wrapper, button } = await mountView();
    expect(wrapper.get("[data-notes]").attributes("data-notes")).toBe("todo-4");

    vi.mocked(getToday).mockResolvedValue(planner([habit()]));
    await button("Erledigt").trigger("click");
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("Lesen");
    expect(wrapper.get("[data-notes]").attributes("data-notes")).toBe(
      "occurrence-20",
    );
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
    expect(
      wrapper.get(".focus-view__campaign .campaign-chip__name").text(),
    ).toBe("Buch schreiben");
    expect(wrapper.get(".focus-view__why").text()).toBe(
      "Mein Wissen weitergeben",
    );
    expect(wrapper.get('[role="timer"]').text()).toBe("00:00");
    expect(wrapper.get(".focus-view__state").text()).toContain("Bereit");
    expect(wrapper.get(".focus-view__state").text()).toContain("Soll 30 Min.");
    expect(wrapper.get(".focus-view__state").text()).toContain(
      "heute schon 12 Min.",
    );
    // Nothing of the rest of the day: no next quest, no distant appointment.
    expect(wrapper.text()).not.toContain("Einkaufen");
    expect(wrapper.text()).not.toContain("Zahnarzt");
    expect(wrapper.find(".focus-view__soon").exists()).toBe(false);
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
    await button("Fortsetzen").trigger("click");
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
    expect(wrapper.text()).not.toContain("Kapitel schreiben");
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

  it("leaves Ctrl+Enter and Space to the notes while typing there", async () => {
    vi.mocked(getToday).mockResolvedValue(planner([todo()]));
    const { start } = await mountView();
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    document.body.append(editor);
    editor.focus();
    for (const init of [{ key: "Enter", ctrlKey: true }, { key: " " }])
      editor.dispatchEvent(
        new KeyboardEvent("keydown", {
          ...init,
          bubbles: true,
          cancelable: true,
        }),
      );
    await flushPromises();
    expect(updateTodoCompletion).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    editor.remove();
  });

  it("leads back to Heute with Escape", async () => {
    vi.mocked(getToday).mockResolvedValue(planner([todo()]));
    await mountView();
    window.location.hash = "#/fokus";
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(window.location.hash).toBe("#/heute");
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

  it("shows a daily run with its campaign, its why and the notes of this run", async () => {
    vi.mocked(getToday).mockResolvedValue(
      planner([
        habit({
          why: "Gesund bleiben",
          campaign: { id: 3, title: "Fit", color: null, icon: null },
        }),
      ]),
    );
    const { wrapper } = await mountView();
    expect(wrapper.get("h1").text()).toBe("Lesen");
    expect(
      wrapper.get(".focus-view__campaign .campaign-chip__name").text(),
    ).toBe("Fit");
    expect(wrapper.get(".focus-view__why").text()).toBe("Gesund bleiben");
    expect(wrapper.get("[data-notes]").attributes("data-notes")).toBe(
      "occurrence-20",
    );
  });

  it("marks the stopwatch button with play and pause", async () => {
    vi.mocked(getToday).mockResolvedValue(planner([todo()]));
    const { wrapper, controller } = await mountView();
    const primary = () => wrapper.get(".focus-view__primary");
    expect(primary().text()).toBe("Starten");
    expect(primary().find("svg").exists()).toBe(true);
    controller.timer.value = stopwatch();
    await wrapper.vm.$nextTick();
    expect(primary().text()).toBe("Pausieren");
    expect(primary().html()).toContain("M9 5.5v13M15 5.5v13");
    controller.timer.value = stopwatch({ state: "paused" });
    await wrapper.vm.$nextTick();
    expect(primary().text()).toBe("Fortsetzen");
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

describe("FocusView: appointments by the rule of Heute's focus card", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // 09:59 in Berlin, with timers that can be moved along.
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2026-10-02T07:59:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  const day = () =>
    planner([
      todo({
        todoId: 7,
        title: "Teamrunde",
        timeOfDay: "10:00",
        plannedDurationMinutes: null,
      }),
      todo({ todoId: 1, title: "Kapitel schreiben" }),
      todo({ todoId: 2, title: "Mails" }),
    ]);

  it("brings the appointment into view during its turn, then the order again", async () => {
    vi.mocked(getToday).mockResolvedValue(day());
    const { wrapper, button } = await mountView();
    expect(wrapper.get("h1").text()).toBe("Kapitel schreiben");
    expect(wrapper.get(".focus-view__soon").text()).toBe(
      "Gleich um 10:00: Teamrunde",
    );

    vi.advanceTimersByTime(60_000 + 100);
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("Teamrunde");
    // Its time range in the facts; no "Später" for an appointment.
    expect(wrapper.get(".focus-view__state").text()).toContain(
      "Termin 10:00–10:30",
    );
    expect(button("Später")).toBeUndefined();
    expect(wrapper.find(".focus-view__soon").exists()).toBe(false);

    // Without a duration its turn lasts the default half hour.
    vi.advanceTimersByTime(30 * 60_000);
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("Kapitel schreiben");
  });

  it("names an appointment only from fifteen minutes before it", async () => {
    vi.mocked(getToday).mockResolvedValue(
      planner([
        todo(),
        todo({ todoId: 5, title: "Zahnarzt", timeOfDay: "10:30" }),
      ]),
    );
    const { wrapper } = await mountView();
    expect(wrapper.find(".focus-view__soon").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Zahnarzt");

    // 10:15: a quarter of an hour before.
    vi.advanceTimersByTime(16 * 60_000 + 100);
    await flushPromises();
    expect(wrapper.get(".focus-view__soon").text()).toBe(
      "Gleich um 10:30: Zahnarzt",
    );
    expect(wrapper.get("h1").text()).toBe("Kapitel schreiben");
  });

  it("opens the due appointment after the quest the stopwatch held is done", async () => {
    vi.mocked(updateTodoCompletion).mockResolvedValue(undefined);
    vi.mocked(getToday).mockResolvedValue(day());
    const { wrapper, button } = await mountView(stopwatch());
    vi.advanceTimersByTime(60_000 + 100);
    await flushPromises();
    // The stopwatch keeps its quest in view; the appointment is named.
    expect(wrapper.get("h1").text()).toBe("Kapitel schreiben");
    expect(wrapper.get(".focus-view__soon").text()).toBe(
      "Seit 10:00: Teamrunde",
    );

    vi.mocked(getToday).mockResolvedValue(
      planner([
        day().items[0]!,
        todo({ status: "completed", completedAt: "2026-10-02T08:00:00Z" }),
        todo({ todoId: 2, title: "Mails" }),
      ]),
    );
    await button("Erledigt").trigger("click");
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("Teamrunde");
  });

  it("does not call the day done while an appointment still waits", async () => {
    vi.mocked(getToday).mockResolvedValue(
      planner([todo({ todoId: 7, title: "Teamrunde", timeOfDay: "15:00" })]),
    );
    const { wrapper } = await mountView();
    expect(wrapper.get("h1").text()).toBe("Nichts in der Reihenfolge");
    expect(wrapper.text()).toContain("Nächster Termin: 15:00 Teamrunde.");
  });
});

describe("FocusView › Fokus-Sperre", () => {
  // The earlier rule by default here; the stopwatch trigger has its own tests.
  const settings: FocusBlockState["settings"] = {
    enabled: true,
    trigger: "threshold",
    thresholdMinutes: 15,
    mode: "soft",
    listMode: "blocklist",
  };
  const YOUTUBE: FocusBlockState["lists"]["block"][number] = {
    id: 1,
    kind: "domain",
    value: "youtube.com",
    label: null,
  };
  const focusState = (
    block: FocusBlockState["block"] = null,
    change: Partial<FocusBlockState["settings"]> = {},
    blocked: FocusBlockState["lists"]["block"] = [YOUTUBE],
  ): FocusBlockState => ({
    version: "v",
    serverNow: new Date().toISOString(),
    settings: { ...settings, ...change },
    block,
    lists: { block: blocked, allow: [] },
    fixedDomains: [],
  });
  /** The phone's plugin; null stands for a browser, which cannot block. */
  const fakeNative = () =>
    ({
      getStatus: vi.fn().mockResolvedValue(null),
      openAccessibilitySettings: vi.fn().mockResolvedValue(undefined),
      requestVpnPermission: vi.fn().mockResolvedValue({ granted: true }),
      listInstalledApps: vi.fn().mockResolvedValue([]),
      setBlock: vi.fn().mockResolvedValue(undefined),
      onOpenFocus: vi.fn(() => () => {}),
    }) satisfies FocusBlockNative;

  async function mountWithFocus(
    block: FocusBlockState["block"] = null,
    running: Timer | null = null,
    change: Partial<FocusBlockState["settings"]> = {},
    device: {
      native?: boolean;
      blocked?: FocusBlockState["lists"]["block"];
      status?: FocusBlockNativeStatus;
    } = {},
  ) {
    const controller = createTimerController();
    controller.timer.value = running;
    const start = vi.spyOn(controller, "start").mockResolvedValue();
    vi.spyOn(controller, "refresh").mockResolvedValue();
    const focus = createFocusBlockController(
      device.native === false ? null : fakeNative(),
    );
    focus.state.value = focusState(block, change, device.blocked);
    if (device.status) focus.device.value = device.status;
    const end = vi.spyOn(focus, "end").mockResolvedValue(true);
    const startBlock = vi.spyOn(focus, "start").mockResolvedValue(true);
    const wrapper = mount(FocusView, {
      attachTo: document.body,
      global: {
        provide: {
          [timerKey as symbol]: controller,
          [focusBlockKey as symbol]: focus,
        },
      },
    });
    await flushPromises();
    const button = (label: string) =>
      wrapper.findAll("button").filter((entry) => entry.text() === label);
    return { wrapper, start, end, startBlock, button };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T06:00:00Z"));
    vi.mocked(listSounds).mockResolvedValue([]);
    resetSoundCatalog();
  });
  afterEach(() => vi.useRealTimers());

  it("offers Soft or Hardcore before a start that blocks and sends the choice along", async () => {
    vi.mocked(getToday).mockResolvedValue(planner([todo()]));
    const { wrapper, start, button } = await mountWithFocus();
    const choice = wrapper.get("[data-test='focus-block-choice']");
    expect(choice.get("[aria-pressed='true']").text()).toBe("Soft");
    await button("Hardcore")[0]!.trigger("click");
    expect(choice.text()).toContain(
      "Die Sperre hält, bis die Quest erledigt oder das Soll erreicht ist.",
    );
    await button("Starten")[0]!.trigger("click");
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "todo",
        targetId: 1,
        focusBlock: { mode: "hardcore" },
      }),
    );
  });

  it("offers nothing for a quest set to Nie or below the threshold", async () => {
    vi.mocked(getToday).mockResolvedValue(
      planner([todo({ focusBlock: "never" })]),
    );
    const first = await mountWithFocus();
    expect(first.wrapper.find("[data-test='focus-block-choice']").exists()).toBe(
      false,
    );
    first.wrapper.unmount();
    vi.mocked(getToday).mockResolvedValue(
      planner([todo({ plannedDurationMinutes: 10 })]),
    );
    const second = await mountWithFocus();
    expect(
      second.wrapper.find("[data-test='focus-block-choice']").exists(),
    ).toBe(false);
  });

  it("shows a Soft block and lifts it only after asking", async () => {
    vi.mocked(getToday).mockResolvedValue(planner([todo()]));
    const { wrapper, end, button } = await mountWithFocus(
      {
        id: "b",
        title: "Kapitel schreiben",
        todoId: 1,
        occurrenceId: null,
        mode: "soft",
        listMode: "blocklist",
        startedAt: new Date().toISOString(),
        endsAt: null,
      },
      stopwatch(),
    );
    expect(wrapper.get("[data-test='focus-block-state'] [role='status']").text()).toBe(
      "Sperre aktiv · Soft",
    );
    await button("Sperre aufheben")[0]!.trigger("click");
    expect(end).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Sperre aufheben?");
    await button("Sperre aufheben")[1]!.trigger("click");
    expect(end).toHaveBeenCalledOnce();
  });

  it("shows the time left of a Hardcore block and offers no way to lift it", async () => {
    vi.mocked(getToday).mockResolvedValue(planner([todo()]));
    const { wrapper, button } = await mountWithFocus(
      {
        id: "b",
        title: "Kapitel schreiben",
        todoId: 1,
        occurrenceId: null,
        mode: "hardcore",
        listMode: "blocklist",
        startedAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 12 * 60_000).toISOString(),
      },
      stopwatch(),
    );
    expect(wrapper.get("[data-test='focus-block-state'] [role='status']").text()).toBe(
      "Sperre aktiv · Hardcore · noch 12 Min.",
    );
    expect(button("Sperre aufheben")).toHaveLength(0);
  });

  it("blocks with the stopwatch trigger also without a Soll, Hardcore until done or stopped", async () => {
    vi.mocked(getToday).mockResolvedValue(
      planner([todo({ plannedDurationMinutes: null })]),
    );
    const { wrapper, button } = await mountWithFocus(null, null, {
      trigger: "stopwatch",
    });
    const choice = wrapper.get("[data-test='focus-block-choice']");
    expect(choice.text()).toContain("Pausieren hebt sie auf.");
    await button("Hardcore")[0]!.trigger("click");
    expect(choice.text()).toContain(
      "Die Sperre hält auch in Pausen, bis die Quest erledigt ist oder du die Stoppuhr beendest.",
    );
  });

  it("reads a Hardcore block that ends with the stopwatch", async () => {
    vi.mocked(getToday).mockResolvedValue(planner([todo()]));
    const { wrapper, button } = await mountWithFocus(
      {
        id: "b",
        title: "Kapitel schreiben",
        todoId: 1,
        occurrenceId: null,
        mode: "hardcore",
        listMode: "blocklist",
        startedAt: new Date().toISOString(),
        endsAt: null,
      },
      stopwatch(),
      { trigger: "stopwatch" },
    );
    const state = wrapper.get("[data-test='focus-block-state']");
    expect(state.get("[role='status']").text()).toBe("Sperre aktiv · Hardcore");
    expect(state.text()).toContain(
      "Endet, wenn die Quest erledigt ist oder du die Stoppuhr beendest.",
    );
    expect(button("Sperre aufheben")).toHaveLength(0);
  });

  it("says in one quiet line below the buttons when an empty Sperrliste blocks nothing", async () => {
    vi.mocked(getToday).mockResolvedValue(planner([todo()]));
    const { wrapper } = await mountWithFocus(
      null,
      null,
      { trigger: "stopwatch" },
      { blocked: [] },
    );
    // No choice that changes nothing, and no hint above "Starten".
    expect(wrapper.find("[data-test='focus-block-choice']").exists()).toBe(
      false,
    );
    expect(wrapper.find("[data-test='focus-setup']").exists()).toBe(false);
    const quiet = wrapper.get("[data-test='focus-block-quiet']");
    expect(quiet.text().replace(/\s+/g, " ")).toBe(
      "Fokus-Sperre: Sperrliste leer · Einrichten",
    );
    expect(quiet.get("a").attributes("href")).toBe(
      "#/einstellungen?abschnitt=fokus-sperre",
    );
    // Read where it stands, not announced on every open.
    expect(quiet.attributes("role")).toBeUndefined();
    expect(quiet.find("strong").exists()).toBe(false);
    // Below Starten and Erledigt.
    const actions = wrapper.get(".focus-view__actions").element;
    expect(
      actions.compareDocumentPosition(quiet.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps the choice in a browser, whose block takes effect on the phone", async () => {
    vi.mocked(getToday).mockResolvedValue(planner([todo()]));
    const { wrapper } = await mountWithFocus(
      null,
      null,
      { trigger: "stopwatch" },
      { native: false },
    );
    expect(wrapper.find("[data-test='focus-block-choice']").exists()).toBe(
      true,
    );
    expect(wrapper.get("[data-test='focus-block-quiet']").text()).toBe(
      "Fokus-Sperre: wirkt auf dem Handy in der Android-App",
    );
  });

  it("names a missing phone permission compactly below the buttons", async () => {
    vi.mocked(getToday).mockResolvedValue(planner([todo()]));
    const { wrapper } = await mountWithFocus(
      null,
      null,
      { trigger: "stopwatch" },
      { status: { accessibilityEnabled: true, vpnPrepared: false } },
    );
    expect(wrapper.find("[data-test='focus-block-choice']").exists()).toBe(
      true,
    );
    expect(wrapper.find("[data-test='focus-block-quiet']").exists()).toBe(
      false,
    );
    const hint = wrapper.get("[data-test='focus-setup']");
    expect(hint.text()).toContain(
      "Fokus-Sperre wirkt noch nicht. Websites sperrt sie erst",
    );
    expect(hint.attributes("role")).toBeUndefined();
    expect(hint.find("[data-test='focus-setup-vpn']").exists()).toBe(true);
    const actions = wrapper.get(".focus-view__actions").element;
    expect(
      actions.compareDocumentPosition(hint.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("starts a block by hand for a stopwatch started elsewhere", async () => {
    vi.mocked(getToday).mockResolvedValue(planner([todo()]));
    const { startBlock, button } = await mountWithFocus(null, stopwatch());
    await button("Sperre starten")[0]!.trigger("click");
    expect(startBlock).toHaveBeenCalledWith("soft");
  });
});

describe("FocusView › Fokus-Klänge", () => {
  const SOUNDS: Sound[] = [
    { id: "lofi-warm", title: "Lo-Fi warm", kind: "music", version: "1" },
    { id: "rain", title: "Regen", kind: "ambience", version: "1" },
    { id: "chime-done", title: "Erledigt", kind: "chime", version: "1" },
  ];
  let play: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T06:00:00Z"));
    resetSoundCatalog();
    localStorage.clear();
    reloadFocusSoundSettings();
    vi.mocked(listSounds).mockResolvedValue(SOUNDS);
    play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(
      () => {},
    );
  });

  const soundButton = (wrapper: Awaited<ReturnType<typeof mountView>>["wrapper"]) =>
    wrapper.get("[data-sound-state]");

  it("starts the chosen sound with Start and stops it with Pausieren", async () => {
    updateFocusSound({ soundId: "rain" });
    vi.mocked(getToday).mockResolvedValue(planner([todo()]));
    const { wrapper, controller, button } = await mountView();
    expect(soundButton(wrapper).attributes("data-sound-state")).toBe("paused");
    expect(soundButton(wrapper).text()).toBe("Klang");

    await button("Starten").trigger("click");
    controller.timer.value = stopwatch();
    await flushPromises();
    expect(soundButton(wrapper).attributes("data-sound-state")).toBe("playing");
    // The state is in words, not only in colour.
    expect(soundButton(wrapper).text()).toBe("Regen");
    expect(soundButton(wrapper).attributes("aria-label")).toBe(
      "Klang: Regen, spielt",
    );
    expect(play).toHaveBeenCalled();

    await button("Pausieren").trigger("click");
    controller.timer.value = stopwatch({ state: "paused" });
    await flushPromises();
    expect(soundButton(wrapper).attributes("data-sound-state")).toBe("paused");
  });

  it("stays silent for a stopwatch that already runs until a sound is picked", async () => {
    vi.mocked(getToday).mockResolvedValue(planner([todo()]));
    const { wrapper } = await mountView(stopwatch());
    expect(soundButton(wrapper).attributes("data-sound-state")).toBe("off");

    await soundButton(wrapper).trigger("click");
    expect(soundButton(wrapper).attributes("aria-expanded")).toBe("true");
    const panel = wrapper.get(".focus-sound__panel");
    expect(panel.findAll("legend").map((legend) => legend.text())).toEqual([
      "Klang im Fokus-Modus",
      "Musik",
      "Geräusche",
    ]);
    expect(panel.get('input[type="range"]').attributes("aria-valuetext")).toBe(
      "60 %",
    );
    await panel.findAll('input[type="radio"]')[2]!.setValue(true);
    expect(soundButton(wrapper).attributes("data-sound-state")).toBe("playing");
    expect(soundButton(wrapper).text()).toBe("Regen");
  });

  it("closes its panel with Escape and stays in the Fokus-Modus", async () => {
    vi.mocked(getToday).mockResolvedValue(planner([todo()]));
    const { wrapper } = await mountView();
    window.location.hash = "#/fokus";
    await soundButton(wrapper).trigger("click");
    const radio = wrapper.get<HTMLInputElement>(".focus-sound__panel input");
    radio.element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushPromises();
    expect(wrapper.find(".focus-sound__panel").exists()).toBe(false);
    expect(document.activeElement).toBe(soundButton(wrapper).element);
    expect(window.location.hash).toBe("#/fokus");
  });

  it("switches the sound on and off with M", async () => {
    vi.mocked(getToday).mockResolvedValue(planner([todo()]));
    const { wrapper } = await mountView(stopwatch());
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "m" }));
    await flushPromises();
    expect(soundButton(wrapper).attributes("data-sound-state")).toBe("playing");
    expect(soundButton(wrapper).text()).toBe("Lo-Fi warm");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "m" }));
    await flushPromises();
    expect(soundButton(wrapper).attributes("data-sound-state")).toBe("off");
  });

  it("sounds Erledigt when the quest is done here, through the shared completion", async () => {
    updateSoundEffects({ enabled: true });
    try {
      vi.mocked(getWeekReview).mockResolvedValue({
        startDate: "2026-09-28",
        perfectWeek: null,
      } as WeekReviewResponse);
      vi.mocked(getToday).mockResolvedValue(planner([todo()]));
      const { wrapper } = await mountView();
      await wrapper
        .get('button[aria-label="Kapitel schreiben erledigen"]')
        .trigger("click");
      await flushPromises();
      expect(updateTodoCompletion).toHaveBeenCalledWith(1, true);
      expect(play).toHaveBeenCalledTimes(1);
      const audio = play.mock.contexts[0] as HTMLAudioElement;
      expect(audio.src).toContain("/api/sounds/chime-done");
    } finally {
      updateSoundEffects({ enabled: false });
    }
  });

  it("notes calmly in the bar when the sound cannot load; the stopwatch goes on", async () => {
    play.mockRejectedValue(new Error("Kein Audio"));
    updateFocusSound({ soundId: "rain" });
    vi.mocked(getToday).mockResolvedValue(planner([todo()]));
    const { wrapper, controller, button } = await mountView();
    await button("Starten").trigger("click");
    controller.timer.value = stopwatch();
    await flushPromises();
    const note = wrapper.get(".focus-view__bar [role='status']");
    expect(note.text()).toBe(
      "Der Klang konnte nicht geladen werden. Der Fokus-Modus läuft ohne ihn weiter.",
    );
    expect(soundButton(wrapper).attributes("data-sound-state")).toBe("paused");
    expect(button("Pausieren").exists()).toBe(true);
    expect(wrapper.find("[role='alert']").exists()).toBe(false);
  });
});
