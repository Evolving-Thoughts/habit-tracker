import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteHabit,
  deleteTodo,
  getHabit,
  getTodo,
  updateHabit,
  updateTodo,
} from "../api/day-planner.api";
import type { HabitResponse } from "../types/habit";
import type { TodoResponse } from "../types/todo";
import PlannerItemEditor from "./PlannerItemEditor.vue";

vi.mock("../api/day-planner.api", () => ({
  getTodo: vi.fn(),
  getHabit: vi.fn(),
  updateTodo: vi.fn(),
  updateHabit: vi.fn(),
  deleteTodo: vi.fn(),
  deleteHabit: vi.fn(),
}));

enableAutoUnmount(afterEach);

const todo: TodoResponse = {
  id: 1,
  title: "NestJS lernen",
  completed: false,
  completedAt: null,
  scheduledAt: "2026-10-02T08:00:12.000Z",
  plannedDurationMinutes: 30,
  isFixed: false,
};

const habit: HabitResponse = {
  id: 10,
  title: "Joggen",
  scheduleType: "interval",
  startDate: "2026-10-02",
  intervalDays: 2,
  weekdays: null,
  weeklyTarget: null,
  missedOccurrencePolicy: "carry_over",
  isActive: true,
};

function mountHabitEditor() {
  return mount(PlannerItemEditor, {
    props: {
      kind: "habit",
      entityId: 10,
    },
  });
}

describe("PlannerItemEditor", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(getTodo).mockResolvedValue(todo);
    vi.mocked(getHabit).mockResolvedValue(habit);

    vi.mocked(updateTodo).mockResolvedValue(todo);
    vi.mocked(updateHabit).mockResolvedValue(habit);

    vi.mocked(deleteTodo).mockResolvedValue(undefined);
    vi.mocked(deleteHabit).mockResolvedValue(undefined);
  });

  it("saves a todo without changing an untouched timestamp", async () => {
    const wrapper = mount(PlannerItemEditor, {
      props: {
        kind: "todo",
        entityId: 1,
      },
    });

    await flushPromises();

    await wrapper.get('input[name="title"]').setValue("Vue lernen");

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(updateTodo).toHaveBeenCalledWith(1, {
      title: "Vue lernen",
      scheduledAt: todo.scheduledAt,
      plannedDurationMinutes: 30,
      isFixed: false,
    });

    expect(wrapper.emitted("changed")).toEqual([[]]);
  });

  it("shows and edits the interval configuration", async () => {
    const wrapper = mountHabitEditor();

    await flushPromises();

    expect(wrapper.text()).toContain("Habit-Art: Intervall");

    expect(
      wrapper.get<HTMLInputElement>('input[name="intervalDays"]').element.value,
    ).toBe("2");

    await wrapper.get('input[name="intervalDays"]').setValue("4");

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(updateHabit).toHaveBeenCalledWith(10, {
      title: "Joggen",
      scheduleType: "interval",
      intervalDays: 4,
      weekdays: null,
      weeklyTarget: null,
      isActive: true,
      missedOccurrencePolicy: "carry_over",
    });
  });

  it("switches from interval to fixed weekdays and clears incompatible fields", async () => {
    const wrapper = mountHabitEditor();

    await flushPromises();

    await wrapper.get('select[name="scheduleType"]').setValue("fixed_weekdays");

    await wrapper.get('input[name="weekdays"][value="monday"]').setValue(true);

    await wrapper
      .get('input[name="weekdays"][value="thursday"]')
      .setValue(true);

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(updateHabit).toHaveBeenCalledWith(10, {
      title: "Joggen",
      scheduleType: "fixed_weekdays",
      intervalDays: null,
      weekdays: ["monday", "thursday"],
      weeklyTarget: null,
      isActive: true,
      missedOccurrencePolicy: "carry_over",
    });
  });

  it("prefills existing weekdays and allows changing them", async () => {
    vi.mocked(getHabit).mockResolvedValueOnce({
      ...habit,
      scheduleType: "fixed_weekdays",
      intervalDays: null,
      weekdays: ["monday", "thursday"],
    });

    const wrapper = mountHabitEditor();

    await flushPromises();

    expect(
      wrapper.get<HTMLInputElement>('input[name="weekdays"][value="monday"]')
        .element.checked,
    ).toBe(true);

    await wrapper.get('input[name="weekdays"][value="monday"]').setValue(false);

    await wrapper
      .get('input[name="weekdays"][value="saturday"]')
      .setValue(true);

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(updateHabit).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        weekdays: ["thursday", "saturday"],
      }),
    );
  });

  it("switches from fixed weekdays to a weekly target", async () => {
    vi.mocked(getHabit).mockResolvedValueOnce({
      ...habit,
      scheduleType: "fixed_weekdays",
      intervalDays: null,
      weekdays: ["monday"],
    });

    const wrapper = mountHabitEditor();

    await flushPromises();

    await wrapper.get('select[name="scheduleType"]').setValue("weekly_target");

    await wrapper.get('input[name="weeklyTarget"]').setValue("5");

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(updateHabit).toHaveBeenCalledWith(10, {
      title: "Joggen",
      scheduleType: "weekly_target",
      intervalDays: null,
      weekdays: null,
      weeklyTarget: 5,
      isActive: true,
      missedOccurrencePolicy: "carry_over",
    });
  });

  it("switches from a weekly target to an interval", async () => {
    vi.mocked(getHabit).mockResolvedValueOnce({
      ...habit,
      scheduleType: "weekly_target",
      intervalDays: null,
      weeklyTarget: 3,
    });

    const wrapper = mountHabitEditor();

    await flushPromises();

    await wrapper.get('select[name="scheduleType"]').setValue("interval");

    await wrapper.get('input[name="intervalDays"]').setValue("3");

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(updateHabit).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        scheduleType: "interval",
        intervalDays: 3,
        weekdays: null,
        weeklyTarget: null,
      }),
    );
  });

  it("rejects fixed weekdays without a selected day", async () => {
    const wrapper = mountHabitEditor();

    await flushPromises();

    await wrapper.get('select[name="scheduleType"]').setValue("fixed_weekdays");

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(updateHabit).not.toHaveBeenCalled();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Bitte wähle mindestens einen Wochentag.",
    );
  });

  it("rejects a weekly target above seven", async () => {
    const wrapper = mountHabitEditor();

    await flushPromises();

    await wrapper.get('select[name="scheduleType"]').setValue("weekly_target");

    await wrapper.get('input[name="weeklyTarget"]').setValue("8");

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(updateHabit).not.toHaveBeenCalled();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Das Wochenziel muss zwischen 1 und 7 liegen.",
    );
  });

  it.each([
    ["todo", 1],
    ["habit", 10],
  ] as const)(
    "requires confirmation before deleting a %s",
    async (kind, entityId) => {
      const wrapper = mount(PlannerItemEditor, {
        props: {
          kind,
          entityId,
        },
      });

      await flushPromises();

      await wrapper.get('[data-test="request-delete"]').trigger("click");

      expect(deleteTodo).not.toHaveBeenCalled();
      expect(deleteHabit).not.toHaveBeenCalled();

      await wrapper.get('[data-test="confirm-delete"]').trigger("click");

      await flushPromises();

      if (kind === "todo") {
        expect(deleteTodo).toHaveBeenCalledWith(1);
        expect(deleteHabit).not.toHaveBeenCalled();
      } else {
        expect(deleteHabit).toHaveBeenCalledWith(10);
        expect(deleteTodo).not.toHaveBeenCalled();
      }

      expect(wrapper.emitted("changed")).toEqual([[]]);
    },
  );

  it("keeps the editor open when deletion fails", async () => {
    vi.mocked(deleteTodo).mockRejectedValueOnce(
      new Error("Löschen fehlgeschlagen"),
    );

    const wrapper = mount(PlannerItemEditor, {
      props: {
        kind: "todo",
        entityId: 1,
      },
    });

    await flushPromises();

    await wrapper.get('[data-test="request-delete"]').trigger("click");

    await wrapper.get('[data-test="confirm-delete"]').trigger("click");

    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe("Löschen fehlgeschlagen");

    expect(wrapper.emitted("changed")).toBeUndefined();

    expect(
      wrapper.get<HTMLFieldSetElement>("form > fieldset").element.disabled,
    ).toBe(false);
  });
});
