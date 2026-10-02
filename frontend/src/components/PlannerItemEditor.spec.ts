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

  it("saves a todo while preserving an unchanged timestamp", async () => {
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

  it("updates the habit definition rather than an occurrence", async () => {
    const wrapper = mount(PlannerItemEditor, {
      props: {
        kind: "habit",
        entityId: 10,
      },
    });

    await flushPromises();

    await wrapper.get('input[name="title"]').setValue("Laufen");

    await wrapper.get('input[name="isActive"]').setValue(false);

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(updateHabit).toHaveBeenCalledWith(10, {
      title: "Laufen",
      isActive: false,
      missedOccurrencePolicy: "carry_over",
    });

    expect(updateTodo).not.toHaveBeenCalled();
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

    expect(wrapper.get<HTMLFieldSetElement>("fieldset").element.disabled).toBe(
      false,
    );
  });
});
