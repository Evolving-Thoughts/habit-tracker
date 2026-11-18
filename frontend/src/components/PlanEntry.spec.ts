import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { WEEK_ENTRY_FIELDS } from "../types/fixtures";
import type { WeekPlanEntry } from "../types/week-plan";
import PlanEntry from "./PlanEntry.vue";

enableAutoUnmount(afterEach);

const quest: WeekPlanEntry = {
  ...WEEK_ENTRY_FIELDS,
  type: "todo",
  todoId: 3,
  title: "Zahnarzt",
  status: "pending",
  scheduledDate: "2026-11-17",
  timeOfDay: "14:30:00",
  plannedDurationMinutes: 45,
  campaign: { id: 1, title: "Gesund bleiben", color: null, icon: null },
};

const mountEntry = (entry: WeekPlanEntry, busy = false) =>
  mount(PlanEntry, { props: { entry, busy } });
/** The pieces of the details line, as read one by one. */
const parts = (wrapper: ReturnType<typeof mountEntry>) =>
  wrapper.findAll(".plan-entry__details > span").map((part) => part.text());
const grip = (wrapper: ReturnType<typeof mountEntry>) =>
  wrapper.get('button[aria-label="Zahnarzt verschieben"]');

describe("PlanEntry", () => {
  it("shows time, planned duration and the campaign with its stripe", () => {
    const wrapper = mountEntry(quest);
    expect(parts(wrapper)).toEqual(["14:30", "45 Min.", "Gesund bleiben"]);
    expect(wrapper.classes()).toContain("plan-entry--campaign");
    expect(wrapper.attributes("style")).toContain("--campaign-mark");
  });

  it("draws the stripe in the campaign's stored colour", () => {
    const wrapper = mountEntry({
      ...quest,
      campaign: { ...quest.campaign!, color: "sage", icon: "leaf" },
    });
    expect(wrapper.attributes("style")).toContain(
      "--campaign-mark: var(--color-mark-sage)",
    );
  });

  it("names the day an overdue quest was planned for, without alarm", () => {
    const wrapper = mountEntry({
      ...quest,
      timeOfDay: null,
      plannedDurationMinutes: null,
      campaign: null,
      isOverdue: true,
      scheduledDate: "2026-11-15",
    });
    expect(parts(wrapper)).toEqual(["seit 15. Nov."]);
  });

  it("opens the editor from the title and moves through the grip", async () => {
    const wrapper = mountEntry(quest);
    await wrapper.get('button[aria-label="Zahnarzt bearbeiten"]').trigger("click");
    await grip(wrapper).trigger("click");
    for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"])
      await grip(wrapper).trigger("keydown", { key });

    expect(wrapper.emitted("edit")).toHaveLength(1);
    expect(wrapper.emitted("move")).toHaveLength(1);
    expect(wrapper.emitted("arrow")).toEqual([
      ["up"],
      ["down"],
      ["left"],
      ["right"],
    ]);
  });

  it("starts nothing while a write runs", () => {
    const wrapper = mountEntry(quest, true);
    expect(grip(wrapper).attributes("disabled")).toBeDefined();
    expect(
      wrapper.get('button[aria-label="Zahnarzt bearbeiten"]').attributes("disabled"),
    ).toBeDefined();
  });

  it("strikes a done quest through and offers no grip", () => {
    const wrapper = mountEntry({ ...quest, status: "completed" });
    expect(wrapper.classes()).toContain("plan-entry--done");
    expect(wrapper.find(".sort-handle").exists()).toBe(false);
  });

  it("shows a daily as a fixed row without any control", () => {
    const wrapper = mountEntry({
      ...WEEK_ENTRY_FIELDS,
      type: "habit",
      habitId: 4,
      occurrenceId: null,
      title: "Laufen",
      status: "pending",
      plannedDurationMinutes: 30,
    });
    expect(wrapper.classes()).toContain("plan-entry--daily");
    expect(parts(wrapper)).toEqual(["Daily", "30 Min."]);
    expect(wrapper.find("button").exists()).toBe(false);
    expect(wrapper.get("h3").text()).toBe("Laufen");
  });
});
