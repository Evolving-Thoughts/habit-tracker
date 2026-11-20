import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WEEK_ENTRY_FIELDS, WEEK_HABIT_FIELDS } from "../types/fixtures";
import type {
  WeekPlanDay,
  WeekPlanEntry,
  WeekPlanHabitEntry,
  WeekPlanTodoEntry,
} from "../types/week-plan";
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

const menu = vi.fn((entry: WeekPlanEntry) => [
  {
    id: "edit",
    label: "Bearbeiten",
    icon: "edit" as const,
    run: () => undefined,
    ariaLabel: `${entry.title}: Bearbeiten`,
  },
]);

const mountDay = (day: WeekPlanDay, today = "2026-11-17") =>
  mount(PlanDay, { props: { day, today, busy: false, menu } });

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

  it("hands a quest's edit up and gives each open quest the view's menu", async () => {
    const entry = quest(1);
    const done = quest(2, { status: "completed" });
    const wrapper = mountDay({ date: "2026-11-18", entries: [entry, done] });
    await wrapper.get('button[aria-label="Quest 1 bearbeiten"]').trigger("click");
    expect(wrapper.emitted("edit")).toEqual([[entry]]);
    expect(menu).toHaveBeenCalledWith(entry);
    expect(menu).not.toHaveBeenCalledWith(done);
    expect(
      wrapper.find('button[aria-label="Aktionen für Quest 1"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('button[aria-label="Aktionen für Quest 2"]').exists(),
    ).toBe(false);
  });

  it("lets a stored run drag like a quest; a forecast run stays put", () => {
    const run = (occurrenceId: number | null): WeekPlanHabitEntry => ({
      ...WEEK_ENTRY_FIELDS,
      ...WEEK_HABIT_FIELDS,
      type: "habit",
      habitId: 4,
      occurrenceId,
      title: occurrenceId ? "Laufen" : "Lesen",
      status: "pending",
    });
    const wrapper = mountDay({
      date: "2026-11-18",
      entries: [run(12), run(null)],
    });
    const [stored, forecast] = wrapper.findAll("ol li");
    expect(stored!.attributes("data-run-id")).toBe("12");
    expect(stored!.attributes("data-todo-id")).toBeUndefined();
    expect(forecast!.attributes("data-run-id")).toBeUndefined();
    expect(menu).toHaveBeenCalledWith(run(12));
  });

  it("opens the editor from a tap anywhere on the card", async () => {
    const entry = quest(1);
    const wrapper = mountDay({ date: "2026-11-18", entries: [entry] });
    await wrapper.get(".plan-entry__details, .plan-entry").trigger("click");
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

  it("puts the quick add on top, above the cards, with where new quests go", () => {
    const wrapper = mountDay({ date: "2026-11-18", entries: [quest(1)] });
    const children = [...wrapper.element.children].map((node) => node.tagName);
    expect(children.indexOf("FORM")).toBeLessThan(children.indexOf("OL"));
    const toggles = wrapper.get('[role="group"]').findAll("button");
    expect(toggles.map((button) => button.attributes("aria-label"))).toEqual([
      "Oben einfügen",
      "Unten einfügen",
    ]);
  });
});
