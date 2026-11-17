import { PLANNER_HABIT_FIELDS, PLANNER_TODO_FIELDS } from "../types/fixtures";
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
    ...PLANNER_TODO_FIELDS,
    type: "todo",
    todoId: 1,
    title: "NestJS lernen",
    status: "pending",
    scheduledDate: "2026-10-02",
    timeOfDay: "10:00",
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

describe("PlannerItem", () => {
  it("shows the given time, duration and the fixed flag once", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeTodo({ categoryName: "Lernen" }),
        time: "10:00",
        isUpdating: false,
      },
    });

    expect(wrapper.get("h3").text()).toBe("NestJS lernen");
    expect(wrapper.get(".planner-item__time").text()).toBe("10:00");
    expect(wrapper.text()).toContain("Lernen");
    expect(wrapper.text()).toContain("30 Min.");
    expect(wrapper.text()).toContain("Termin");
    // The day is today; repeating it on every row is noise.
    expect(wrapper.text()).not.toContain("02.10.2026");
  });

  it("puts logged time beside the planned time and names the goal", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeTodo({
          workedMinutes: 45,
          plannedDurationMinutes: 60,
          goal: {
            title: "Halbmarathon",
            completed: null,
            target: null,
            periodEnd: null,
          },
        }),
        isUpdating: false,
      },
    });
    expect(wrapper.text()).toContain("45/60 Min.");
  });

  it("marks the campaign an item works towards", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeTodo({ campaign: { id: 4, title: "Halbmarathon" } }),
        isUpdating: false,
      },
    });
    expect(wrapper.get(".planner-item__campaign").text()).toBe("Halbmarathon");
    expect(wrapper.classes()).toContain("planner-item--campaign");
    expect(wrapper.attributes("style")).toContain("--campaign-mark");

    const loose = mount(PlannerItem, {
      props: { item: makeTodo(), isUpdating: false },
    });
    expect(loose.classes()).not.toContain("planner-item--campaign");
  });

  it("offers a grip that also sorts with the arrow keys", async () => {
    const item = makeTodo({ timeOfDay: null });
    const wrapper = mount(PlannerItem, {
      props: { item, isUpdating: false, sortable: true },
    });
    const grip = wrapper.get(".sort-handle");
    expect(grip.attributes("aria-label")).toBe(
      "NestJS lernen in der Reihenfolge verschieben",
    );
    await grip.trigger("keydown", { key: "ArrowUp" });
    await grip.trigger("keydown", { key: "ArrowDown" });
    expect(wrapper.emitted("shift")).toEqual([
      [item, -1],
      [item, 1],
    ]);
    // The grip takes the place of the time column.
    expect(wrapper.find(".planner-item__time").exists()).toBe(false);
  });

  it("shows the original day for carried-over items and hides actions when compact", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeHabit({ isOverdue: true, scheduledDate: "2026-09-28" }),
        isUpdating: false,
        showDate: true,
        compact: true,
      },
    });
    expect(wrapper.get(".planner-item__time").text()).toBe("28.09.");
    expect(wrapper.find(".planner-item__skip-button").exists()).toBe(false);
  });

  it("offers no Play for a completed Quest", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeTodo({
          timeOfDay: null,
          completedAt: "2026-10-02T18:30:00Z",
          status: "completed",
        }),
        isUpdating: false,
      },
    });
    expect(
      wrapper.find('[aria-label="Timer für NestJS lernen starten"]').exists(),
    ).toBe(false);
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

    expect(
      wrapper.get(".planner-item__check").attributes("aria-busy"),
    ).toBe("true");
  });

  it("names each action after its item for screen readers", () => {
    const wrapper = mount(PlannerItem, {
      props: {
        item: makeHabit({ moveUntil: "2026-10-04" }),
        isUpdating: false,
      },
    });
    expect(
      wrapper.find('button[aria-label="Joggen überspringen"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('button[aria-label="Joggen verschieben"]').exists(),
    ).toBe(true);
  });
});
