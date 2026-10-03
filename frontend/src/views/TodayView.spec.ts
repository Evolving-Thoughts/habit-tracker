import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getToday,
  createTodo,
  createHabit,
  getHabit,
  changeHabitSchedule,
  updateOccurrenceStatus,
  updateTodoCompletion,
} from "../api/day-planner.api";
import type {
  DayPlannerHabitItem,
  DayPlannerResponse,
  DayPlannerTodoItem,
} from "../types/day-planner";
import TodayView from "./TodayView.vue";

vi.mock("../api/day-planner.api", () => ({
  getToday: vi.fn(),
  createTodo: vi.fn(),
  createHabit: vi.fn(),
  updateOccurrenceStatus: vi.fn(),
  updateTodoCompletion: vi.fn(),
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
    ...overrides,
  };
}

function makeHabit(
  overrides: Partial<DayPlannerHabitItem> = {},
): DayPlannerHabitItem {
  return {
    type: "habit",
    occurrenceId: 20,
    habitId: 10,
    title: "Joggen",
    status: "pending",
    scheduledDate: "2026-10-02",
    scheduleType: "interval",
    isOverdue: false,
    ...overrides,
  };
}

function makePlanner(
  items: DayPlannerResponse["items"] = [],
): DayPlannerResponse {
  return {
    date: "2026-10-02",
    items,
  };
}

describe("TodayView", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    getTodayMock.mockResolvedValue(makePlanner());
    updateTodoMock.mockResolvedValue(undefined);
    updateOccurrenceMock.mockResolvedValue(undefined);
  });

  it("shows loading while the initial request is pending", async () => {
    let resolveRequest!: (planner: DayPlannerResponse) => void;

    getTodayMock.mockReturnValueOnce(
      new Promise<DayPlannerResponse>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const wrapper = mount(TodayView);

    expect(wrapper.text()).toContain("Tagesplan wird geladen");

    expect(getTodayMock).toHaveBeenCalledTimes(1);

    resolveRequest(makePlanner());
    await flushPromises();

    expect(wrapper.text()).not.toContain("Tagesplan wird geladen");
  });

  it("shows an empty state after loading an empty planner", async () => {
    const wrapper = mount(TodayView);

    await flushPromises();

    expect(wrapper.text()).toContain("02.10.2026");
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

  it("groups overdue, open and resolved items", async () => {
    getTodayMock.mockResolvedValueOnce(
      makePlanner([
        makeTodo({
          title: "Überfälliges Todo",
          scheduledDate: "2026-10-01",
          scheduledAt: "2026-10-01T08:00:00.000Z",
          isOverdue: true,
        }),
        makeHabit({
          title: "Offenes Habit",
        }),
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

    const sections = wrapper.findAll(".today-section");

    expect(sections).toHaveLength(3);

    expect(sections[0]!.get("h2").text()).toBe("Überfällig");
    expect(sections[0]!.text()).toContain("Überfälliges Todo");

    expect(sections[1]!.get("h2").text()).toBe("Offen");
    expect(sections[1]!.text()).toContain("Offenes Habit");

    expect(sections[2]!.get("h2").text()).toBe("Abgeschlossen");
    expect(sections[2]!.text()).toContain("Erledigtes Todo");
    expect(sections[2]!.text()).toContain("Übersprungenes Habit");

    expect(sections[2]!.findAll(".planner-item")).toHaveLength(2);
  });

  it("completes a todo and reloads the planner", async () => {
    getTodayMock
      .mockResolvedValueOnce(makePlanner([makeTodo()]))
      .mockResolvedValueOnce(
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

    expect(wrapper.get(".planner-item__status").text()).toBe("Erledigt");
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

    await wrapper.get(".planner-item__skip-button").trigger("click");

    await flushPromises();

    expect(updateOccurrenceMock).toHaveBeenCalledWith(20, "skipped");

    expect(getTodayMock).toHaveBeenCalledTimes(2);
  });

  it("shows an update error without reloading the planner", async () => {
    getTodayMock.mockResolvedValueOnce(makePlanner([makeTodo()]));

    updateTodoMock.mockRejectedValueOnce(new Error("Speichern fehlgeschlagen"));

    const wrapper = mount(TodayView);

    await flushPromises();

    await wrapper
      .get('button[aria-label="NestJS lernen erledigen"]')
      .trigger("click");

    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Speichern fehlgeschlagen",
    );

    expect(getTodayMock).toHaveBeenCalledTimes(1);

    // Der ursprüngliche Eintrag bleibt offen.
    expect(wrapper.get(".planner-item__status").text()).toBe("Offen");

    expect(
      wrapper.get<HTMLButtonElement>(".planner-item__check").element.disabled,
    ).toBe(false);
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

    expect(
      wrapper.get<HTMLButtonElement>(".planner-item__check").element.disabled,
    ).toBe(false);
  });

  it("reloads the planner when refresh is clicked", async () => {
    const wrapper = mount(TodayView);

    await flushPromises();

    await wrapper.get(".today-view__refresh").trigger("click");

    await flushPromises();

    expect(getTodayMock).toHaveBeenCalledTimes(2);
  });
});

describe("TodayView habit schedule editing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
    getTodayMock.mockResolvedValue(makePlanner([makeHabit()]));
    vi.mocked(getHabit).mockResolvedValue({
      id: 10,
      title: "Joggen",
      isActive: true,
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
      id: 10,
      title: "Joggen",
      isActive: true,
      currentSchedule: null,
      upcomingSchedule: null,
    });
    vi.mocked(createTodo).mockResolvedValue({
      id: 1,
      title: "Test",
      completed: false,
      completedAt: null,
      scheduledAt: null,
      plannedDurationMinutes: null,
      isFixed: false,
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
    await wrapper.get(".create-dialog__close").trigger("click");
    expect(wrapper.find("dialog").exists()).toBe(false);
    await wrapper
      .get('button[aria-label="Eintrag erstellen"]')
      .trigger("click");
    expect(wrapper.find('[data-test="choose-habit"]').exists()).toBe(true);
    expect(createTodo).not.toHaveBeenCalled();
  });
});
