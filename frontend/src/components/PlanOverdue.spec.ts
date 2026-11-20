import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WEEK_ENTRY_FIELDS, WEEK_HABIT_FIELDS } from "../types/fixtures";
import type {
  WeekPlanEntry,
  WeekPlanHabitEntry,
  WeekPlanTodoEntry,
} from "../types/week-plan";
import PlanOverdue from "./PlanOverdue.vue";

enableAutoUnmount(afterEach);

const left = (todoId: number): WeekPlanTodoEntry => ({
  ...WEEK_ENTRY_FIELDS,
  type: "todo",
  todoId,
  title: `Quest ${todoId}`,
  status: "pending",
  scheduledDate: "2026-11-14",
  isOverdue: true,
});
const run: WeekPlanHabitEntry = {
  ...WEEK_ENTRY_FIELDS,
  ...WEEK_HABIT_FIELDS,
  type: "habit",
  habitId: 3,
  occurrenceId: 9,
  title: "Laufen",
  status: "pending",
  isOverdue: true,
};
const menu = vi.fn((entry: WeekPlanEntry) => [
  {
    id: "edit",
    label: "Bearbeiten",
    icon: "edit" as const,
    run: () => undefined,
    ariaLabel: `${entry.title}: Bearbeiten`,
  },
]);

describe("PlanOverdue", () => {
  it("names what was left behind and since when; quests and runs move", async () => {
    const wrapper = mount(PlanOverdue, {
      props: { entries: [left(1), run], busy: false, menu },
    });
    expect(wrapper.get("h2").text()).toBe("Liegen geblieben 2");
    expect(wrapper.attributes("aria-labelledby")).toBe(
      wrapper.get("h2").attributes("id"),
    );
    const rows = wrapper.findAll("li");
    expect(rows[0]!.attributes("data-todo-id")).toBe("1");
    expect(rows[0]!.text()).toContain("seit 14. Nov.");
    expect(rows[1]!.attributes("data-todo-id")).toBeUndefined();
    expect(rows[1]!.attributes("data-run-id")).toBe("9");
    expect(menu).toHaveBeenCalledTimes(2);
    // No quick add and no arrow keys: it only gives quests away.
    expect(wrapper.find("form").exists()).toBe(false);
    expect(
      wrapper
        .get('button[aria-label="Quest 1 bearbeiten"]')
        .attributes("aria-keyshortcuts"),
    ).toBeUndefined();
    await wrapper.get('button[aria-label="Quest 1 bearbeiten"]').trigger("click");
    expect(wrapper.emitted("edit")).toEqual([[left(1)]]);
  });
});
