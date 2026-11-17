import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WEEK_ENTRY_FIELDS } from "../types/fixtures";
import type { WeekPlanDay, WeekPlanTodoEntry } from "../types/week-plan";
import PlanDay from "./PlanDay.vue";

vi.mock("../api/day-planner.api", () => ({
  createTodo: vi.fn(),
  reorderDay: vi.fn(),
}));

enableAutoUnmount(afterEach);

const quest = (
  todoId: number,
  overrides: Partial<WeekPlanTodoEntry> = {},
): WeekPlanTodoEntry => ({
  ...WEEK_ENTRY_FIELDS,
  type: "todo",
  todoId,
  title: `Quest ${todoId}`,
  status: "pending",
  scheduledDate: "2026-11-18",
  ...overrides,
});

const mountDay = (day: WeekPlanDay, today = "2026-11-17") =>
  mount(PlanDay, { props: { day, today, busy: false } });

describe("PlanDay", () => {
  it("is a region named by its day, with open and done as separate lists", () => {
    const wrapper = mountDay({
      date: "2026-11-18",
      entries: [
        quest(1, { plannedDurationMinutes: 25 }),
        quest(2, { status: "completed" }),
      ],
    });
    const heading = wrapper.get("h2");
    expect(wrapper.attributes("aria-labelledby")).toBe(heading.attributes("id"));
    expect(heading.text()).toContain("Mittwoch");
    expect(wrapper.get(".plan-day__summary").text()).toBe("1 offen · 25 Min.");
    const [open, done] = wrapper.findAll("ol");
    expect(open!.attributes("aria-label")).toBe("Offen am Mittwoch, 18. Nov.");
    expect(open!.get("li").attributes("data-todo-id")).toBe("1");
    expect(done!.attributes("aria-label")).toBe("Erledigt am Mittwoch, 18. Nov.");
    expect(done!.text()).toContain("Quest 2");
    expect(wrapper.attributes("aria-current")).toBeUndefined();
  });

  it("hands a quest's actions up with the quest", async () => {
    const entry = quest(1);
    const wrapper = mountDay({ date: "2026-11-18", entries: [entry] });
    await wrapper.get('button[aria-label="Quest 1 verschieben"]').trigger("keydown", {
      key: "ArrowRight",
    });
    await wrapper.get('button[aria-label="Quest 1 bearbeiten"]').trigger("click");
    expect(wrapper.emitted("arrow")).toEqual([[entry, "right"]]);
    expect(wrapper.emitted("edit")).toEqual([[entry]]);
  });

  it("keeps an empty day quiet but open for a new quest", () => {
    const wrapper = mountDay({ date: "2026-11-18", entries: [] });
    expect(wrapper.find(".plan-day__summary").exists()).toBe(false);
    expect(wrapper.get(".plan-day__empty").text()).toBe("Noch frei.");
    expect(
      wrapper
        .get('input[name="quickTitle"]')
        .attributes("aria-label"),
    ).toBe("Quest für Mittwoch, 18. Nov. hinzufügen");
  });

  it("offers nothing new on a past day", () => {
    const wrapper = mountDay({ date: "2026-11-16", entries: [] });
    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.get(".plan-day__empty").text()).toBe("Nichts mehr offen.");
  });
});
