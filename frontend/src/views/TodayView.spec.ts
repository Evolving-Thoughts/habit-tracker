import {
  HABIT_FIELDS,
  NO_QUEST_HOURS,
  TODO_FIELDS,
  PLANNER_HABIT_FIELDS,
  PLANNER_TODO_FIELDS,
} from "../types/fixtures";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getToday,
  reorderDay,
  createTodo,
  createHabit,
  getHabit,
  changeHabitSchedule,
  rescheduleTodo,
  updateOccurrenceStatus,
  updateTodoCompletion,
} from "../api/day-planner.api";
import type {
  DayPlannerHabitItem,
  DayPlannerResponse,
  DayPlannerTodoItem,
} from "../types/day-planner";
import TodayView from "./TodayView.vue";
import {
  reloadShortcutSettings,
  setSingleKeys,
} from "../composables/useShortcuts";
import {
  createTimerController,
  timerKey,
  type TimerController,
} from "../composables/useTimer";

vi.mock("../api/categories.api", () => ({
  getCategories: vi.fn().mockResolvedValue([]),
}));
vi.mock("../api/day-planner.api", () => ({
  getToday: vi.fn(),
  reorderDay: vi.fn(),
  createTodo: vi.fn(),
  createHabit: vi.fn(),
  updateOccurrenceStatus: vi.fn(),
  updateTodoCompletion: vi.fn(),
  rescheduleTodo: vi.fn(),
  rescheduleOccurrence: vi.fn(),
  getTodo: vi.fn(),
  getHabit: vi.fn(),
  updateTodo: vi.fn(),
  updateHabit: vi.fn(),
  changeHabitSchedule: vi.fn(),
  deleteTodo: vi.fn(),
  deleteHabit: vi.fn(),
}));

enableAutoUnmount(afterEach);

const getTodayMock = vi.mocked(getToday);
const updateTodoMock = vi.mocked(updateTodoCompletion);
const updateOccurrenceMock = vi.mocked(updateOccurrenceStatus);

function makeTodo(
  overrides: Partial<DayPlannerTodoItem> = {},
): DayPlannerTodoItem {
  return {
    ...PLANNER_TODO_FIELDS,
    type: "todo",
    todoId: 1,
    title: "NestJS lernen",
    status: "pending",
    scheduledDate: "2026-10-02",
    completedAt: null,
    plannedDurationMinutes: 30,
    isOverdue: false,
    timerEligible: true,
    ...overrides,
  };
}

function makeHabit(
  overrides: Partial<DayPlannerHabitItem> = {},
): DayPlannerHabitItem {
  return {
    ...PLANNER_HABIT_FIELDS,
    type: "habit",
    plannedDurationMinutes: null,
    occurrenceId: 20,
    habitId: 10,
    title: "Joggen",
    status: "pending",
    scheduledDate: "2026-10-02",
    moveUntil: null,
    scheduleType: "interval",
    isOverdue: false,
    timerEligible: true,
    ...overrides,
  };
}

function makePlanner(
  items: DayPlannerResponse["items"] = [],
): DayPlannerResponse {
  return {
    date: "2026-10-02",
    items,
    externalEvents: [],
    workedMinutes: 0,
    questHours: NO_QUEST_HOURS,
  };
}

describe("TodayView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // 08:00 in Berlin.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T06:00:00Z"));

    getTodayMock.mockResolvedValue(makePlanner());
    updateTodoMock.mockResolvedValue(undefined);
    updateOccurrenceMock.mockResolvedValue(undefined);
    vi.mocked(rescheduleTodo).mockResolvedValue(undefined as never);
    vi.mocked(reorderDay).mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it("shows loading while the initial request is pending", async () => {
    let resolveRequest!: (planner: DayPlannerResponse) => void;

    getTodayMock.mockReturnValueOnce(
      new Promise<DayPlannerResponse>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const wrapper = mount(TodayView);

    expect(
      wrapper.find('[aria-label="Tagesplan wird geladen"]').exists(),
    ).toBe(true);
    expect(getTodayMock).toHaveBeenCalledTimes(1);

    resolveRequest(makePlanner());
    await flushPromises();

    expect(
      wrapper.find('[aria-label="Tagesplan wird geladen"]').exists(),
    ).toBe(false);
  });

  it("shows an empty state after loading an empty planner", async () => {
    const wrapper = mount(TodayView);

    await flushPromises();

    expect(wrapper.get("h1").text()).toBe("Freitag, 2. Okt.");
    expect(wrapper.text()).toContain("Für heute ist nichts geplant.");
    expect(wrapper.findAll(".planner-item")).toHaveLength(0);
  });

  it("shows the quest hours of today and the week in the head", async () => {
    getTodayMock.mockResolvedValue({
      ...makePlanner([makeTodo()]),
      questHours: {
        todayMinutes: 80,
        weekMinutes: 360,
        weeklyTargetMinutes: 1200,
      },
    });
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.get(".today-view__quest").text()).toBe(
      "Quest-Stunden heute 1 Std. 20 Min. · Woche 6 Std. von 20 Std.",
    );
  });

  it("leaves the quest hours out without measured time and goal", async () => {
    getTodayMock.mockResolvedValue(makePlanner([makeTodo()]));
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.find(".today-view__quest").exists()).toBe(false);
  });

  it("shows an error when loading fails", async () => {
    getTodayMock.mockRejectedValueOnce(new Error("Backend nicht erreichbar"));

    const wrapper = mount(TodayView);

    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Backend nicht erreichbar",
    );
  });

  it("arranges focus, catch-up and the resolved items", async () => {
    getTodayMock.mockResolvedValueOnce(
      makePlanner([
        makeTodo({
          title: "Überfälliges Quest",
          scheduledDate: "2026-10-01",
          isOverdue: true,
        }),
        makeHabit({ title: "Offenes Daily" }),
        makeTodo({
          todoId: 2,
          title: "Erledigtes Quest",
          status: "completed",
          completedAt: "2026-10-02T10:00:00.000Z",
        }),
        makeHabit({
          occurrenceId: 21,
          title: "Übersprungenes Daily",
          status: "skipped",
        }),
      ]),
    );

    const wrapper = mount(TodayView);
    await flushPromises();

    expect(wrapper.get(".focus").text()).toContain("Offenes Daily");
    expect(wrapper.get(".today-view__progress").text()).toBe(
      "2 von 3 erledigt",
    );
    const catchUp = wrapper.get(".catch-up__toggle");
    expect(catchUp.text()).toContain("1 Eintrag von früher");
    expect(wrapper.text()).not.toContain("Überfälliges Quest");
    await catchUp.trigger("click");
    expect(wrapper.get(".catch-up__body").text()).toContain(
      "Überfälliges Quest",
    );

    const resolved = wrapper.get(".resolved__toggle");
    expect(resolved.text()).toContain("2 abgeschlossen");
    await resolved.trigger("click");
    expect(wrapper.findAll("#resolved-list .planner-item")).toHaveLength(2);
  });

  it("shows the why and the goal on the focus only", async () => {
    getTodayMock.mockResolvedValueOnce(
      makePlanner([
        makeHabit({
          why: "Halbmarathon im März",
          goal: {
            title: "20 Läufe",
            completed: 12,
            target: 20,
            periodEnd: "2026-12-31",
          },
        }),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.get(".focus__why").text()).toBe("Halbmarathon im März");
    expect(wrapper.get(".focus__meta").text()).toContain(
      "20 Läufe: 12 von 20 bis 31.12.2026",
    );
  });

  it("shows the order of the day under the focus and appointments on the axis", async () => {
    getTodayMock.mockResolvedValueOnce(
      makePlanner([
        makeTodo({ todoId: 3, title: "Zahnarzt", timeOfDay: "14:00" }),
        makeTodo(),
        makeTodo({ todoId: 2, title: "Bewerbung" }),
        makeHabit({ title: "Lesen" }),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.get("#focus-title").text()).toBe("NestJS lernen");
    expect(
      wrapper.findAll(".order .planner-item h3").map((row) => row.text()),
    ).toEqual(["Bewerbung", "Lesen"]);
    expect(wrapper.get(".timeline").text()).toContain("14:00");
    expect(wrapper.get(".timeline").text()).toContain("Zahnarzt");
    expect(wrapper.get(".timeline").text()).not.toContain("Bewerbung");
  });

  it("sorts with the grip's arrow keys, shows it at once and stores it", async () => {
    const first = makeTodo();
    const second = makeTodo({ todoId: 2, title: "Bewerbung" });
    const third = makeHabit({ title: "Lesen" });
    getTodayMock
      .mockResolvedValueOnce(makePlanner([first, second, third]))
      .mockResolvedValue(makePlanner([first, third, second]));
    let stored = (): void => undefined;
    vi.mocked(reorderDay).mockReturnValueOnce(
      new Promise<void>((resolve) => (stored = resolve)),
    );
    const wrapper = mount(TodayView, { attachTo: document.body });
    await flushPromises();

    const grip = (title: string) =>
      wrapper.get(
        `button[aria-label="${title} in der Reihenfolge verschieben"]`,
      );
    await grip("Lesen").trigger("keydown", { key: "ArrowUp" });

    // Before the server has answered, the new order already shows.
    expect(
      wrapper.findAll(".order .planner-item h3").map((row) => row.text()),
    ).toEqual(["Lesen", "Bewerbung"]);
    expect(reorderDay).toHaveBeenCalledWith([
      { type: "todo", id: 1 },
      { type: "habit", id: 20 },
      { type: "todo", id: 2 },
    ]);
    expect(wrapper.get('[role="status"].visually-hidden').text()).toBe(
      "„Lesen“ steht jetzt an Stelle 2 von 3.",
    );

    stored();
    await flushPromises();
    expect(document.activeElement).toBe(grip("Lesen").element);
  });

  it("makes another quest the focus when it moves to the head of the order", async () => {
    const first = makeTodo();
    const second = makeTodo({ todoId: 2, title: "Bewerbung" });
    getTodayMock
      .mockResolvedValueOnce(makePlanner([first, second]))
      .mockResolvedValue(makePlanner([second, first]));
    const wrapper = mount(TodayView);
    await flushPromises();

    await wrapper
      .get('button[aria-label="Bewerbung in der Reihenfolge verschieben"]')
      .trigger("keydown", { key: "ArrowUp" });
    await flushPromises();

    expect(wrapper.get("#focus-title").text()).toBe("Bewerbung");
    expect(reorderDay).toHaveBeenCalledWith([
      { type: "todo", id: 2 },
      { type: "todo", id: 1 },
    ]);
  });

  it("goes back to the stored order when saving it fails", async () => {
    const first = makeTodo();
    const second = makeTodo({ todoId: 2, title: "Bewerbung" });
    const third = makeTodo({ todoId: 3, title: "Einkaufen" });
    getTodayMock.mockResolvedValue(makePlanner([first, second, third]));
    vi.mocked(reorderDay).mockRejectedValueOnce(new Error("Offline"));
    const wrapper = mount(TodayView);
    await flushPromises();

    await wrapper
      .get('button[aria-label="Einkaufen in der Reihenfolge verschieben"]')
      .trigger("keydown", { key: "ArrowUp" });
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe("Offline");
    await wrapper.vm.$nextTick();
  });

  it("moves everything open to tomorrow after asking, appointments stay", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 3, title: "Zahnarzt", timeOfDay: "14:00" }),
        makeTodo(),
        makeTodo({ todoId: 2, title: "Bewerbung" }),
        // This daily cannot move: its window ends today.
        makeHabit({ title: "Lesen", moveUntil: "2026-10-02" }),
      ]),
    );
    const wrapper = mount(TodayView, { attachTo: document.body });
    await flushPromises();

    await wrapper.get(".today-view__postpone").trigger("click");
    expect(rescheduleTodo).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "2 offene Einträge wandern auf morgen",
    );
    document
      .querySelector<HTMLButtonElement>("[data-postpone-confirm]")!
      .click();
    await flushPromises();

    expect(vi.mocked(rescheduleTodo).mock.calls).toEqual([
      [1, "2026-10-03", false],
      [2, "2026-10-03", false],
    ]);
  });

  it("completes the focus, reloads and offers undo", async () => {
    getTodayMock
      .mockResolvedValueOnce(makePlanner([makeTodo()]))
      .mockResolvedValue(
        makePlanner([
          makeTodo({
            status: "completed",
            completedAt: "2026-10-02T10:00:00.000Z",
          }),
        ]),
      );

    const wrapper = mount(TodayView);
    await flushPromises();

    await wrapper
      .get('button[aria-label="NestJS lernen erledigen"]')
      .trigger("click");
    await flushPromises();

    expect(updateTodoMock).toHaveBeenCalledWith(1, true);
    expect(getTodayMock).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("Alles für heute erledigt.");
    expect(wrapper.get(".today-view__toast").text()).toContain(
      "„NestJS lernen“ erledigt",
    );

    await wrapper.get(".today-view__toast button").trigger("click");
    await flushPromises();
    expect(updateTodoMock).toHaveBeenLastCalledWith(1, false);
  });

  it("reopens a completed todo", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({
          status: "completed",
          completedAt: "2026-10-02T10:00:00.000Z",
        }),
      ]),
    );

    const wrapper = mount(TodayView);
    await flushPromises();
    await wrapper.get(".resolved__toggle").trigger("click");

    await wrapper
      .get('button[aria-label="NestJS lernen wieder öffnen"]')
      .trigger("click");
    await flushPromises();

    expect(updateTodoMock).toHaveBeenCalledWith(1, false);
  });

  it.each([
    ["pending", "completed", "erledigen"],
    ["completed", "pending", "wieder öffnen"],
    ["skipped", "pending", "wieder öffnen"],
  ] as const)(
    "changes a habit from %s to %s",
    async (initialStatus, targetStatus, actionLabel) => {
      getTodayMock.mockResolvedValue(
        makePlanner([makeHabit({ status: initialStatus })]),
      );

      const wrapper = mount(TodayView);
      await flushPromises();
      if (initialStatus !== "pending")
        await wrapper.get(".resolved__toggle").trigger("click");

      await wrapper
        .get(`button[aria-label="Joggen ${actionLabel}"]`)
        .trigger("click");
      await flushPromises();

      expect(updateOccurrenceMock).toHaveBeenCalledWith(20, targetStatus);
      expect(updateTodoMock).not.toHaveBeenCalled();
      expect(getTodayMock).toHaveBeenCalledTimes(2);
    },
  );

  it("skips a pending habit", async () => {
    getTodayMock.mockResolvedValue(makePlanner([makeHabit()]));

    const wrapper = mount(TodayView);
    await flushPromises();

    // Überspringen waits in the menu, not as a button on the card.
    expect(
      wrapper.find('button[aria-label="Joggen überspringen"]').exists(),
    ).toBe(false);
    await wrapper.get('[aria-label="Aktionen für Joggen"]').trigger("click");
    await wrapper
      .get('button[aria-label="Joggen überspringen"]')
      .trigger("click");
    await flushPromises();

    expect(updateOccurrenceMock).toHaveBeenCalledWith(20, "skipped");
    expect(getTodayMock).toHaveBeenCalledTimes(2);
  });

  it("shows an update error without reloading the planner", async () => {
    getTodayMock.mockResolvedValueOnce(makePlanner([makeTodo()]));
    updateTodoMock.mockRejectedValueOnce(new Error("Speichern fehlgeschlagen"));

    const wrapper = mount(TodayView);
    await flushPromises();

    const done = wrapper.get<HTMLButtonElement>(
      'button[aria-label="NestJS lernen erledigen"]',
    );
    await done.trigger("click");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Speichern fehlgeschlagen",
    );
    expect(getTodayMock).toHaveBeenCalledTimes(1);
    expect(wrapper.get("#focus-title").text()).toBe("NestJS lernen");
    expect(done.element.disabled).toBe(false);
    expect(wrapper.find(".today-view__toast button").exists()).toBe(false);
  });

  it("disables an item while its update is pending", async () => {
    let resolveUpdate!: () => void;

    getTodayMock.mockResolvedValue(makePlanner([makeTodo()]));
    updateTodoMock.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveUpdate = resolve;
      }),
    );

    const wrapper = mount(TodayView);
    await flushPromises();

    const button = wrapper.get<HTMLButtonElement>(
      'button[aria-label="NestJS lernen erledigen"]',
    );
    await button.trigger("click");

    expect(button.element.disabled).toBe(true);
    expect(updateTodoMock).toHaveBeenCalledTimes(1);

    resolveUpdate();
    await flushPromises();
  });

  it("plans every movable carried-over item for today in one go", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({
          title: "Alt eins",
          scheduledDate: "2026-09-30",
          isOverdue: true,
        }),
        makeTodo({
          todoId: 2,
          title: "Alt zwei",
          scheduledDate: "2026-10-01",
          isOverdue: true,
        }),
        makeTodo({
          todoId: 3,
          title: "Termin von gestern",
          scheduledDate: "2026-10-01",
          timeOfDay: "11:00",
          isOverdue: true,
        }),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    await wrapper.get(".catch-up__toggle").trigger("click");

    const all = wrapper.get(".catch-up__all");
    expect(all.text()).toBe("Alle 2 heute einplanen");
    await all.trigger("click");
    await flushPromises();

    expect(vi.mocked(rescheduleTodo).mock.calls).toEqual([
      [1, "2026-10-02", false],
      [2, "2026-10-02", false],
    ]);
  });
});

describe("TodayView habit schedule editing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
    getTodayMock.mockResolvedValue(makePlanner([makeHabit()]));
    vi.mocked(getHabit).mockResolvedValue({
    ...HABIT_FIELDS,
      id: 10,
      title: "Joggen",
      isActive: true,
      plannedDurationMinutes: null,
      timerOccurrenceId: null,
      timerDurationMinutes: null,
      upcomingSchedule: null,
      currentSchedule: {
        id: 100,
        effectiveFrom: "2026-10-01",
        effectiveAt: "2026-10-01T08:00:00Z",
        endsAt: null,
        cancelledAt: null,
        firstDueDate: "2026-10-01",
        schedule: {
          type: "interval",
          intervalDays: 2,
          missedOccurrencePolicy: "carry_over",
        },
      },
    });
  });
  afterEach(() => vi.useRealTimers());

  it("saves a future rule and reloads the planner", async () => {
    vi.mocked(changeHabitSchedule).mockResolvedValue(await getHabit(10));
    const wrapper = mount(TodayView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="Joggen bearbeiten"]')
      .trigger("click");
    await flushPromises();
    await wrapper.get('input[name="changeSchedule"]').setValue(true);
    await wrapper.get('input[name="effectiveFrom"]').setValue("2026-10-10");
    await wrapper.get('input[name="intervalDays"]').setValue("4");
    await wrapper.get(".item-editor form").trigger("submit");
    await flushPromises();
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-10",
      schedule: {
        type: "interval",
        intervalDays: 4,
        missedOccurrencePolicy: "carry_over",
      },
    });
    expect(getTodayMock).toHaveBeenCalledTimes(2);
    expect(wrapper.find(".item-editor").exists()).toBe(false);
  });

  it("preserves the editor and does not reload after a schedule conflict", async () => {
    vi.mocked(changeHabitSchedule).mockRejectedValue(
      new Error("Schedule conflict"),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="Joggen bearbeiten"]')
      .trigger("click");
    await flushPromises();
    await wrapper.get('input[name="changeSchedule"]').setValue(true);
    await wrapper.get(".item-editor form").trigger("submit");
    await flushPromises();
    expect(wrapper.get('.item-editor [role="alert"]').text()).toBe(
      "Schedule conflict",
    );
    expect(getTodayMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find(".item-editor").exists()).toBe(true);
  });
});

describe("TodayView creation flow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getTodayMock.mockResolvedValue(makePlanner());
    vi.mocked(createHabit).mockResolvedValue({
    ...HABIT_FIELDS,
      id: 10,
      title: "Joggen",
      isActive: true,
      plannedDurationMinutes: null,
      timerOccurrenceId: null,
      timerDurationMinutes: null,
      currentSchedule: null,
      upcomingSchedule: null,
    });
    vi.mocked(createTodo).mockResolvedValue({
    ...TODO_FIELDS,
      id: 1,
      parentId: null,
      title: "Test",
      completed: false,
      completedAt: null,
      scheduledDate: null,
      timeOfDay: null,
      plannedDurationMinutes: null,
      timerEligible: true,
    });
  });
  it("hides the forms until plus is clicked and presents both choices", async () => {
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(wrapper.find(".create-todo").exists()).toBe(false);
    await wrapper
      .get('button[aria-label="Eintrag erstellen"]')
      .trigger("click");
    expect(wrapper.find('[data-test="choose-todo"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="choose-habit"]').exists()).toBe(true);
  });
  it.each(["todo", "habit"] as const)(
    "creates a %s through plus and refreshes the planner",
    async (kind) => {
      const wrapper = mount(TodayView);
      await flushPromises();
      await wrapper
        .get('button[aria-label="Eintrag erstellen"]')
        .trigger("click");
      await wrapper.get(`[data-test="choose-${kind}"]`).trigger("click");
      await wrapper.get('dialog input[name="title"]').setValue("Test");
      await wrapper.get("dialog form").trigger("submit");
      await flushPromises();
      expect(kind === "todo" ? createTodo : createHabit).toHaveBeenCalledTimes(
        1,
      );
      expect(wrapper.find("dialog").exists()).toBe(false);
      expect(getTodayMock).toHaveBeenCalledTimes(2);
      expect(wrapper.get('[role="status"]').text()).toContain(
        kind === "todo" ? "Quest erstellt" : "Daily erstellt",
      );
    },
  );
  it("retains the habit creation form after failure without refreshing", async () => {
    vi.mocked(createHabit).mockRejectedValueOnce(
      new Error("Backend nicht erreichbar"),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="Eintrag erstellen"]')
      .trigger("click");
    await wrapper.get('[data-test="choose-habit"]').trigger("click");
    await wrapper.get('dialog input[name="title"]').setValue("Joggen");
    await wrapper.get("dialog form").trigger("submit");
    await flushPromises();
    expect(wrapper.get('dialog [role="alert"]').text()).toBe(
      "Backend nicht erreichbar",
    );
    expect(wrapper.find("dialog").exists()).toBe(true);
    expect(getTodayMock).toHaveBeenCalledTimes(1);
  });
  it("closes on cancellation and resets the next opening to the choice", async () => {
    const wrapper = mount(TodayView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="Eintrag erstellen"]')
      .trigger("click");
    await wrapper.get('[data-test="choose-todo"]').trigger("click");
    await wrapper.get(".modal-dialog__close").trigger("click");
    expect(wrapper.find("dialog").exists()).toBe(false);
    await wrapper
      .get('button[aria-label="Eintrag erstellen"]')
      .trigger("click");
    expect(wrapper.find('[data-test="choose-habit"]').exists()).toBe(true);
    expect(createTodo).not.toHaveBeenCalled();
  });

  it("opens a Daily editor in a modal and restores focus on close", async () => {
    getTodayMock.mockResolvedValueOnce(makePlanner([makeHabit()]));
    vi.mocked(getHabit).mockResolvedValue({
    ...HABIT_FIELDS,
      id: 10,
      title: "Joggen",
      isActive: true,
      plannedDurationMinutes: null,
      timerOccurrenceId: null,
      timerDurationMinutes: null,
      currentSchedule: null,
      upcomingSchedule: null,
    });
    const wrapper = mount(TodayView, { attachTo: document.body });
    await flushPromises();
    const button = wrapper.get<HTMLButtonElement>("[data-edit-button]");
    button.element.focus();
    await button.trigger("click");
    await flushPromises();
    expect(wrapper.get("dialog").attributes("aria-label")).toBe(
      "Daily bearbeiten",
    );
    expect(document.activeElement).toBe(
      wrapper.get('dialog input[name="title"]').element,
    );
    await wrapper.get(".modal-dialog__close").trigger("click");
    await flushPromises();
    expect(document.activeElement).toBe(
      wrapper.get("[data-edit-button]").element,
    );
    wrapper.unmount();
  });
});

describe("TodayView keyboard shortcuts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T06:00:00Z"));
    localStorage.clear();
    reloadShortcutSettings();
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 1, title: "Erstens" }),
        makeTodo({ todoId: 2, title: "Zweitens" }),
        makeTodo({ todoId: 3, title: "Drittens" }),
      ]),
    );
    updateTodoMock.mockResolvedValue(undefined);
    updateOccurrenceMock.mockResolvedValue(undefined);
    vi.mocked(rescheduleTodo).mockResolvedValue(undefined as never);
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  async function mountToday(controller?: TimerController) {
    const wrapper = mount(TodayView, {
      attachTo: document.body,
      global: controller
        ? { provide: { [timerKey as symbol]: controller } }
        : {},
    });
    await flushPromises();
    return wrapper;
  }
  const row = (key: string) =>
    document.querySelector<HTMLElement>(`[data-focus-key="${key}"]`)!;
  function hover(key: string): void {
    row(key).dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  }
  function press(key: string, target: EventTarget = document.body) {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  }

  it("ticks the hovered row with X, like its ring, and offers undo", async () => {
    const wrapper = await mountToday();
    hover("todo-2");
    expect(press("x").defaultPrevented).toBe(true);
    await flushPromises();
    expect(updateTodoMock).toHaveBeenCalledWith(2, true);
    expect(wrapper.get(".today-view__toast").text()).toContain(
      "„Zweitens“ erledigt",
    );
  });

  it("moves the hovered row to tomorrow with D and says so", async () => {
    const wrapper = await mountToday();
    hover("todo-3");
    press("d");
    await flushPromises();
    expect(rescheduleTodo).toHaveBeenCalledWith(3, "2026-10-03", false);
    expect(wrapper.get('[role="status"].visually-hidden').text()).toBe(
      "„Drittens“ steht jetzt bei morgen.",
    );
  });

  it("moves to next Monday with W and does nothing with T for a row of today", async () => {
    await mountToday();
    hover("todo-2");
    expect(press("t").defaultPrevented).toBe(false);
    press("w");
    await flushPromises();
    // 2 Oct 2026 is a Friday.
    expect(vi.mocked(rescheduleTodo).mock.calls).toEqual([
      [2, "2026-10-05", false],
    ]);
  });

  it("brings a carried-over quest to today with T", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 1, title: "Heute" }),
        makeTodo({
          todoId: 4,
          title: "Von gestern",
          scheduledDate: "2026-10-01",
          isOverdue: true,
        }),
      ]),
    );
    const wrapper = await mountToday();
    await wrapper.get(".catch-up__toggle").trigger("click");
    hover("todo-4");
    press("t");
    await flushPromises();
    expect(rescheduleTodo).toHaveBeenCalledWith(4, "2026-10-02", false);
  });

  it("opens Verschieben for an appointment instead of moving it", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 1, title: "Erstens" }),
        makeTodo({ todoId: 5, title: "Zahnarzt", timeOfDay: "18:00" }),
      ]),
    );
    const wrapper = await mountToday();
    hover("todo-5");
    press("d");
    await flushPromises();
    expect(rescheduleTodo).not.toHaveBeenCalled();
    expect(wrapper.get("dialog").attributes("aria-label")).toBe("Verschieben");
  });

  it("ignores a finished row", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 1, title: "Erstens" }),
        makeTodo({
          todoId: 6,
          title: "Fertig",
          status: "completed",
          completedAt: "2026-10-02T05:00:00Z",
        }),
      ]),
    );
    const wrapper = await mountToday();
    await wrapper.get(".resolved__toggle").trigger("click");
    hover("todo-6");
    expect(press("x").defaultPrevented).toBe(false);
    expect(press("d").defaultPrevented).toBe(false);
    expect(updateTodoMock).not.toHaveBeenCalled();
    expect(rescheduleTodo).not.toHaveBeenCalled();
  });

  it("moves the focus on to the next row when the focused row is ticked", async () => {
    getTodayMock
      .mockResolvedValueOnce(
        makePlanner([
          makeTodo({ todoId: 1, title: "Erstens" }),
          makeTodo({ todoId: 2, title: "Zweitens" }),
          makeTodo({ todoId: 3, title: "Drittens" }),
        ]),
      )
      .mockResolvedValue(
        makePlanner([
          makeTodo({ todoId: 1, title: "Erstens" }),
          makeTodo({
            todoId: 2,
            title: "Zweitens",
            status: "completed",
            completedAt: "2026-10-02T06:00:00Z",
          }),
          makeTodo({ todoId: 3, title: "Drittens" }),
        ]),
      );
    await mountToday();
    const edit =
      row("todo-2").querySelector<HTMLElement>("[data-edit-button]")!;
    edit.focus();
    press("x", edit);
    await flushPromises();
    expect(updateTodoMock).toHaveBeenCalledWith(2, true);
    expect(document.activeElement).toBe(
      row("todo-3").querySelector("[data-edit-button]"),
    );
  });

  it("starts the hovered row's stopwatch with Space", async () => {
    const controller = createTimerController();
    const start = vi.spyOn(controller, "start").mockResolvedValue();
    await mountToday(controller);
    hover("todo-3");
    expect(press(" ").defaultPrevented).toBe(true);
    expect(start).toHaveBeenCalledWith({
      kind: "todo",
      targetId: 3,
      title: "Drittens",
    });
  });

  it("puts N into the quick add field, and keys typed there stay text", async () => {
    await mountToday();
    press("n");
    await flushPromises();
    const field = document.querySelector<HTMLInputElement>(
      'input[name="quickTitle"]',
    )!;
    expect(document.activeElement).toBe(field);
    hover("todo-2");
    expect(press("x", field).defaultPrevented).toBe(false);
    expect(press("d", field).defaultPrevented).toBe(false);
    expect(updateTodoMock).not.toHaveBeenCalled();
  });

  it("does nothing with single keys switched off", async () => {
    setSingleKeys(false);
    await mountToday();
    hover("todo-2");
    press("x");
    await flushPromises();
    expect(updateTodoMock).not.toHaveBeenCalled();
    setSingleKeys(true);
  });
});

describe("TodayView rows and focus card", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T06:00:00Z"));
    localStorage.clear();
    reloadShortcutSettings();
    updateTodoMock.mockResolvedValue(undefined);
    updateOccurrenceMock.mockResolvedValue(undefined);
    vi.mocked(rescheduleTodo).mockResolvedValue(undefined as never);
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  const texts = (
    wrapper: { findAll(selector: string): { text(): string }[] },
    selector: string,
  ) => wrapper.findAll(selector).map((element) => element.text());

  it("keeps the focus card to one action row: Erledigt, ▶, Fokus-Modus and its menu", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeHabit({ moveUntil: "2026-10-04" }),
        makeTodo({ todoId: 2, title: "Danach" }),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();

    const focus = wrapper.get(".focus");
    const actions = focus.get(".focus__actions");
    expect(
      actions
        .findAll("button, a")
        .map((control) => control.attributes("aria-label")),
    ).toEqual([
      "Joggen erledigen",
      "Timer für Joggen starten",
      "Fokus-Modus",
      "Aktionen für Joggen",
    ]);
    // The Fokus-Modus is an icon link with its name as tooltip.
    const mode = actions.get('a[aria-label="Fokus-Modus"]');
    expect(mode.attributes("title")).toBe("Fokus-Modus");
    expect(mode.text()).toBe("");
    // No text buttons for Überspringen or Bearbeiten on the card.
    expect(texts(focus, "button")).not.toContain("Überspringen");
    expect(texts(focus, "button")).not.toContain("Bearbeiten");
    // The grip sits in the card's head, beside the title, not in the actions.
    expect(
      focus.get(".focus__head .sort-handle").attributes("aria-label"),
    ).toBe("Joggen in der Reihenfolge verschieben");
    expect(actions.find(".sort-handle").exists()).toBe(false);

    await actions.get('[aria-label="Aktionen für Joggen"]').trigger("click");
    expect(texts(wrapper, "[role=menuitem] .action-menu__label")).toEqual([
      "Überspringen",
      "Morgen",
      "Anderer Tag …",
    ]);
  });

  it("opens the editor from the focus card's title", async () => {
    getTodayMock.mockResolvedValue(makePlanner([makeTodo()]));
    const wrapper = mount(TodayView, {
      global: {
        stubs: {
          EditItemDialog: {
            props: ["kind", "entityId"],
            template:
              '<div class="editor-stub">{{ kind }} {{ entityId }}</div>',
          },
        },
      },
    });
    await flushPromises();
    const title = wrapper.get('.focus h2[aria-label="NestJS lernen"] button');
    expect(title.attributes("aria-label")).toBe("NestJS lernen bearbeiten");
    await title.trigger("click");
    expect(wrapper.get(".editor-stub").text()).toBe("todo 1");
  });

  it("shows rows with ring, title, ▶ and a menu, and no text buttons", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 1, title: "Erstens" }),
        makeTodo({ todoId: 2, title: "Zweitens" }),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    const row = wrapper.get('[data-focus-key="todo-2"]');
    expect(
      row.findAll("button").map((button) => button.attributes("aria-label")),
    ).toEqual([
      "Zweitens in der Reihenfolge verschieben",
      "Zweitens erledigen",
      "Zweitens bearbeiten",
      "Timer für Zweitens starten",
      "Aktionen für Zweitens",
    ]);
    expect(row.text()).not.toContain("Verschieben");
  });

  it("moves a row to tomorrow from its menu the way D does", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 1, title: "Erstens" }),
        makeTodo({ todoId: 2, title: "Zweitens" }),
      ]),
    );
    const wrapper = mount(TodayView, { attachTo: document.body });
    await flushPromises();
    await wrapper.get('[aria-label="Aktionen für Zweitens"]').trigger("click");
    const entries = wrapper.findAll("[role=menuitem]");
    expect(
      entries.map((entry) => entry.get(".action-menu__label").text()),
    ).toEqual(["Morgen", "Nächste Woche", "Anderer Tag …"]);
    // The keys that do the same are named for assistive technology.
    expect(entries[0]!.attributes("aria-keyshortcuts")).toBe("D");
    expect(entries[1]!.attributes("aria-keyshortcuts")).toBe("W");
    await wrapper.get('[aria-label="Zweitens auf morgen"]').trigger("click");
    await flushPromises();
    expect(rescheduleTodo).toHaveBeenCalledWith(2, "2026-10-03", false);
    expect(wrapper.get('[role="status"].visually-hidden').text()).toBe(
      "„Zweitens“ steht jetzt bei morgen.",
    );
  });

  it("offers an appointment only Verschieben, where the move is confirmed", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 1, title: "Erstens" }),
        makeTodo({ todoId: 2, title: "Zahnarzt", timeOfDay: "15:00" }),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    await wrapper.get('[aria-label="Aktionen für Zahnarzt"]').trigger("click");
    expect(texts(wrapper, "[role=menuitem] .action-menu__label")).toEqual([
      "Termin verschieben …",
    ]);
    await wrapper.get('[aria-label="Zahnarzt verschieben"]').trigger("click");
    expect(wrapper.find('[data-test="move-confirm"]').exists()).toBe(true);
  });

  it("says in words which row's stopwatch runs", async () => {
    getTodayMock.mockResolvedValue(
      makePlanner([
        makeTodo({ todoId: 1, title: "Erstens" }),
        makeTodo({ todoId: 2, title: "Zweitens" }),
      ]),
    );
    const controller = createTimerController();
    controller.timer.value = {
      id: "t",
      kind: "todo",
      targetId: 2,
      title: "Zweitens",
      state: "running",
      elapsedMilliseconds: 1000,
      targetMinutes: null,
      targetReachedAt: null,
    };
    const wrapper = mount(TodayView, {
      global: { provide: { [timerKey as symbol]: controller } },
    });
    await flushPromises();
    const row = wrapper.get('[data-focus-key="todo-2"]');
    expect(row.get(".item-row__running").text()).toBe("läuft");
    expect(
      row
        .find('[aria-label="Stoppuhr für Zweitens läuft, pausieren"]')
        .exists(),
    ).toBe(true);
    expect(wrapper.find(".focus__running").exists()).toBe(false);

    controller.timer.value = {
      ...controller.timer.value,
      targetId: 1,
      title: "Erstens",
      state: "paused",
    };
    await flushPromises();
    expect(wrapper.get(".focus__running").text()).toBe("pausiert");
    controller.dispose();
  });
});
