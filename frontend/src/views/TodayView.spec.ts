import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getToday,
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
  updateOccurrenceStatus: vi.fn(),
  updateTodoCompletion: vi.fn(),
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
