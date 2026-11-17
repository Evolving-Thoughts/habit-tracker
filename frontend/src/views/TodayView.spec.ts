import { HABIT_FIELDS, TODO_FIELDS, PLANNER_HABIT_FIELDS, PLANNER_TODO_FIELDS } from "../types/fixtures";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getToday,
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

vi.mock("../api/categories.api", () => ({
  getCategories: vi.fn().mockResolvedValue([]),
}));
vi.mock("../api/day-planner.api", () => ({
  getToday: vi.fn(),
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
    scheduledAt: "2026-10-02T08:00:00.000Z",
    completedAt: null,
    plannedDurationMinutes: 30,
    isFixed: false,
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
  };
}

describe("TodayView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // 08:00 in Berlin; the default todo is planned for 10:00.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T06:00:00Z"));

    getTodayMock.mockResolvedValue(makePlanner());
    updateTodoMock.mockResolvedValue(undefined);
    updateOccurrenceMock.mockResolvedValue(undefined);
    vi.mocked(rescheduleTodo).mockResolvedValue(undefined as never);
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
          title: "Überfälliges Todo",
          scheduledDate: "2026-10-01",
          scheduledAt: "2026-10-01T08:00:00.000Z",
          isOverdue: true,
        }),
        makeHabit({ title: "Offenes Habit" }),
        makeTodo({
          todoId: 2,
          title: "Erledigtes Todo",
          status: "completed",
          completedAt: "2026-10-02T10:00:00.000Z",
        }),
        makeHabit({
          occurrenceId: 21,
          title: "Übersprungenes Habit",
          status: "skipped",
        }),
      ]),
    );

    const wrapper = mount(TodayView);
    await flushPromises();

    expect(wrapper.get(".focus").text()).toContain("Offenes Habit");
    expect(wrapper.get(".today-view__progress").text()).toBe(
      "2 von 3 erledigt",
    );
    const catchUp = wrapper.get(".catch-up__toggle");
    expect(catchUp.text()).toContain("1 Eintrag von früher");
    expect(wrapper.text()).not.toContain("Überfälliges Todo");
    await catchUp.trigger("click");
    expect(wrapper.get(".catch-up__body").text()).toContain(
      "Überfälliges Todo",
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

  it("names the next step after the focus and puts the rest on the time axis", async () => {
    getTodayMock.mockResolvedValueOnce(
      makePlanner([
        makeTodo(),
        makeTodo({
          todoId: 2,
          title: "Bewerbung",
          scheduledAt: "2026-10-02T10:00:00.000Z",
        }),
      ]),
    );
    const wrapper = mount(TodayView);
    await flushPromises();
    expect(wrapper.get("#focus-title").text()).toBe("NestJS lernen");
    expect(wrapper.get(".today-view__next").text()).toContain(
      "12:00 Bewerbung",
    );
    expect(wrapper.get(".timeline").text()).toContain("Bewerbung");
    expect(wrapper.get(".timeline").text()).not.toContain("NestJS lernen");
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
          scheduledAt: "2026-09-30T08:00:00.000Z",
          isOverdue: true,
        }),
        makeTodo({
          todoId: 2,
          title: "Alt zwei",
          scheduledDate: "2026-10-01",
          scheduledAt: "2026-10-01T08:00:00.000Z",
          isOverdue: true,
        }),
        makeTodo({
          todoId: 3,
          title: "Fester Termin",
          scheduledDate: "2026-10-01",
          scheduledAt: "2026-10-01T09:00:00.000Z",
          isFixed: true,
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
      scheduledAt: null,
      plannedDurationMinutes: null,
      isFixed: false,
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
        kind === "todo" ? "Todo erstellt" : "Habit erstellt",
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

  it("opens a Habit editor in a modal and restores focus on close", async () => {
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
      "Habit bearbeiten",
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
