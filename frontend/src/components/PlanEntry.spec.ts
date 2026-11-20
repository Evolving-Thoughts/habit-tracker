import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { WEEK_ENTRY_FIELDS } from "../types/fixtures";
import type { WeekPlanEntry } from "../types/week-plan";
import type { MenuEntry } from "../utils/row-actions";
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

const MENU: MenuEntry[] = [
  { id: "edit", label: "Bearbeiten", icon: "edit", run: () => undefined },
];
const mountEntry = (entry: WeekPlanEntry, busy = false) =>
  mount(PlanEntry, {
    props: {
      entry,
      busy,
      menu:
        entry.type === "todo" && entry.status === "pending" ? MENU : undefined,
    },
  });
/** The pieces of the details line, as read one by one. */
const parts = (wrapper: ReturnType<typeof mountEntry>) =>
  wrapper.findAll(".plan-entry__details > span").map((part) => part.text());
const trigger = (wrapper: ReturnType<typeof mountEntry>) =>
  wrapper.get('button[aria-label="Aktionen für Zahnarzt"]');

describe("PlanEntry", () => {
  it("shows time, planned duration and the campaign with its stripe", () => {
    const wrapper = mountEntry(quest);
    expect(parts(wrapper)).toEqual(["14:30", "45 Min."]);
    // The campaign's chip has a line of its own; cut short, its tooltip names it.
    const chip = wrapper.get(".plan-entry__campaign .campaign-chip");
    expect(chip.get(".campaign-chip__name").text()).toBe("Gesund bleiben");
    expect(chip.attributes("title")).toBe("Gesund bleiben");
    expect(wrapper.classes()).toContain("plan-entry--campaign");
    expect(wrapper.attributes("style")).toContain("--campaign-mark");
  });

  it("moves with the arrow keys while its card has the focus, not while busy", async () => {
    const moving = mount(PlanEntry, {
      props: { entry: quest, busy: false, menu: MENU, arrows: true },
    });
    const card = moving.get("[data-edit-button]");
    for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"])
      await card.trigger("keydown", { key });
    expect(moving.emitted("arrow")).toEqual([
      ["up"],
      ["down"],
      ["left"],
      ["right"],
    ]);

    const fixed = mountEntry(quest);
    await fixed.get("[data-edit-button]").trigger("keydown", { key: "ArrowUp" });
    expect(fixed.emitted("arrow")).toBeUndefined();
    expect(
      fixed.get("[data-edit-button]").attributes("aria-keyshortcuts"),
    ).toBeUndefined();
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

  it("keeps the full title in the names and the tooltip of a clamped title", () => {
    const title =
      "Steuererklärung vorbereiten und alle Belege aus dem Ordner im Keller zusammensuchen";
    const wrapper = mountEntry({ ...quest, title });
    expect(wrapper.get("h3").attributes("aria-label")).toBe(title);
    const edit = wrapper.get("[data-edit-button]");
    expect(edit.attributes("aria-label")).toBe(`${title} bearbeiten`);
    expect(edit.attributes("title")).toBe(title);
  });

  it("opens the editor from the title and from a tap on the card", async () => {
    const wrapper = mountEntry(quest);
    await wrapper.get('button[aria-label="Zahnarzt bearbeiten"]').trigger("click");
    await wrapper.get(".plan-entry__details").trigger("click");
    // The card's own controls keep their tap.
    await trigger(wrapper).trigger("click");
    expect(wrapper.emitted("edit")).toHaveLength(2);
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(["card-target", "card-drag"]),
    );
    expect(wrapper.find(".sort-handle").exists()).toBe(false);
  });

  it("starts nothing while a write runs", async () => {
    const wrapper = mountEntry(quest, true);
    expect(trigger(wrapper).attributes("disabled")).toBeDefined();
    await wrapper.get(".plan-entry__details").trigger("click");
    expect(wrapper.emitted("edit")).toBeUndefined();
    expect(
      wrapper.get('button[aria-label="Zahnarzt bearbeiten"]').attributes("disabled"),
    ).toBeDefined();
  });

  it("strikes a done quest through; it no longer drags", () => {
    const wrapper = mountEntry({ ...quest, status: "completed" });
    expect(wrapper.classes()).toContain("plan-entry--done");
    expect(wrapper.classes()).not.toContain("card-drag");
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
    expect(wrapper.get("h3").attributes("title")).toBe("Laufen");
    expect(wrapper.classes()).not.toContain("card-target");
  });
});
