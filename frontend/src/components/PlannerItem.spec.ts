import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import type {
  DayPlannerHabitItem,
  DayPlannerTodoItem,
} from "../types/day-planner";
import PlannerItem from "./PlannerItem.vue";

enableAutoUnmount(afterEach);

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
    isFixed: true,
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

describe("PlannerItem", () => {
  it("shows a todo with German date, time and duration", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeTodo(),
        isUpdating: false,
      },
    });

    expect(wrapper.get("h3").text()).toBe("NestJS lernen");

    expect(wrapper.text()).toContain("02.10.2026");

    // Am 02.10. gilt in Berlin UTC+2.
    expect(wrapper.text()).toContain("10:00");
    expect(wrapper.text()).toContain("30 Min.");
    expect(wrapper.text()).toContain("Fester Termin");

    expect(wrapper.get(".planner-item__status").text()).toBe("Offen");
  });

  it("emits toggle with the original item", async () => {
    const item = makeTodo();

    const wrapper = mount(PlannerItem, {
      props: {
        item,
        isUpdating: false,
      },
    });

    await wrapper
      .get('button[aria-label="NestJS lernen erledigen"]')
      .trigger("click");

    expect(wrapper.emitted("toggle")).toEqual([[item]]);
  });

  it("emits skip for a pending habit", async () => {
    const item = makeHabit();

    const wrapper = mount(PlannerItem, {
      props: {
        item,
        isUpdating: false,
      },
    });

    await wrapper.get(".planner-item__skip-button").trigger("click");

    expect(wrapper.emitted("skip")).toEqual([[item]]);
  });

  it("emits edit for a todo", async () => {
    const item = makeTodo();

    const wrapper = mount(PlannerItem, {
      props: {
        item,
        isUpdating: false,
      },
    });

    await wrapper
      .get('button[aria-label="NestJS lernen bearbeiten"]')
      .trigger("click");

    expect(wrapper.emitted("edit")).toEqual([[item]]);

    expect(wrapper.emitted("toggle")).toBeUndefined();
  });

  it("emits edit for a habit", async () => {
    const item = makeHabit();

    const wrapper = mount(PlannerItem, {
      props: {
        item,
        isUpdating: false,
      },
    });

    await wrapper
      .get('button[aria-label="Joggen bearbeiten"]')
      .trigger("click");

    expect(wrapper.emitted("edit")).toEqual([[item]]);

    expect(wrapper.emitted("toggle")).toBeUndefined();
    expect(wrapper.emitted("skip")).toBeUndefined();
  });

  it("does not offer a skip action for todos", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeTodo(),
        isUpdating: false,
      },
    });

    expect(wrapper.find(".planner-item__skip-button").exists()).toBe(false);
  });

  it.each(["completed", "skipped"] as const)(
    "offers reopening and editing for a %s habit",
    (status) => {
      const wrapper = mount(PlannerItem, {
        props: {
          item: makeHabit({ status }),
          isUpdating: false,
        },
      });

      expect(wrapper.get(".planner-item__check").attributes("aria-label")).toBe(
        "Joggen wieder öffnen",
      );

      expect(wrapper.find(".planner-item__skip-button").exists()).toBe(false);

      expect(
        wrapper.find('button[aria-label="Joggen bearbeiten"]').exists(),
      ).toBe(true);
    },
  );

  it("marks overdue items visually", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeTodo({ isOverdue: true }),
        isUpdating: false,
      },
    });

    expect(wrapper.classes()).toContain("planner-item--overdue");

    expect(wrapper.get(".planner-item__status").text()).toBe("Überfällig");
  });

  it("disables all habit actions while an update is running", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeHabit(),
        isUpdating: true,
      },
    });

    const buttons = wrapper.findAll("button");

    // Abhaken, Überspringen und Bearbeiten.
    expect(buttons).toHaveLength(3);

    for (const button of buttons) {
      expect(button.element.disabled).toBe(true);
    }

    expect(wrapper.get(".planner-item__check").text()).toBe("…");
  });
});
