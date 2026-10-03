import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeHabitSchedule,
  createHabit,
  deleteHabit,
  getHabit,
  getHabits,
  updateHabit,
} from "../api/day-planner.api";
import type {
  HabitResponse,
  HabitScheduleRule,
  ScheduleVersionResponse,
} from "../types/habit";
import HabitsView from "./HabitsView.vue";
vi.mock("../api/day-planner.api", () => ({
  getHabits: vi.fn(),
  getHabit: vi.fn(),
  updateHabit: vi.fn(),
  changeHabitSchedule: vi.fn(),
  deleteHabit: vi.fn(),
  createHabit: vi.fn(),
  createTodo: vi.fn(),
  getTodo: vi.fn(),
  updateTodo: vi.fn(),
  deleteTodo: vi.fn(),
}));
enableAutoUnmount(afterEach);
afterEach(() => vi.useRealTimers());
function version(
  schedule: HabitScheduleRule = {
    type: "interval",
    intervalDays: 2,
    missedOccurrencePolicy: "carry_over",
  },
  effectiveFrom = "2026-10-02",
): ScheduleVersionResponse {
  return {
    id: 100,
    effectiveFrom,
    effectiveAt: `${effectiveFrom}T08:00:00Z`,
    endsAt: null,
    cancelledAt: null,
    firstDueDate: effectiveFrom,
    schedule,
  };
}
function habit(overrides: Partial<HabitResponse> = {}): HabitResponse {
  return {
    id: 10,
    title: "Joggen",
    isActive: true,
    currentSchedule: version(),
    upcomingSchedule: null,
    ...overrides,
  };
}
describe("HabitsView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
    vi.mocked(getHabits).mockResolvedValue([]);
    vi.mocked(getHabit).mockResolvedValue(habit());
    vi.mocked(updateHabit).mockResolvedValue(habit());
    vi.mocked(changeHabitSchedule).mockResolvedValue(habit());
    vi.mocked(createHabit).mockResolvedValue(habit());
    vi.mocked(deleteHabit).mockResolvedValue(undefined);
  });
  it("shows loading and disables actions until the first request resolves", async () => {
    let resolve!: (value: HabitResponse[]) => void;
    vi.mocked(getHabits).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const wrapper = mount(HabitsView);
    expect(wrapper.text()).toContain("Habits werden geladen");
    expect(
      wrapper.get<HTMLButtonElement>(".create-button").element.disabled,
    ).toBe(true);
    resolve([]);
    await flushPromises();
    expect(wrapper.text()).not.toContain("Habits werden geladen");
  });
  it("shows an empty state with no persistent creation form", async () => {
    const wrapper = mount(HabitsView);
    await flushPromises();
    expect(wrapper.text()).toContain("Du hast noch keine Habits.");
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(wrapper.find("form").exists()).toBe(false);
  });
  it("groups active and paused habits and shows their current schedules", async () => {
    vi.mocked(getHabits).mockResolvedValueOnce([
      habit(),
      habit({
        id: 11,
        title: "Gitarre spielen",
        isActive: false,
        currentSchedule: version({
          type: "fixed_weekdays",
          weekdays: ["thursday", "monday"],
          missedOccurrencePolicy: "skip",
        }),
      }),
    ]);
    const wrapper = mount(HabitsView);
    await flushPromises();
    expect(wrapper.get('[data-group="active"]').text()).toContain("Joggen");
    expect(wrapper.get('[data-group="paused"]').text()).toContain(
      "Gitarre spielen",
    );
    expect(wrapper.text()).toContain("Montag, Donnerstag");
    expect(wrapper.text()).toContain("Alle 2 Tage");
    expect(wrapper.text()).toContain("02.10.2026");
    expect(wrapper.findAll("[data-habit-id]")).toHaveLength(2);
  });
  it("shows a future-only habit so it can be edited before it is due", async () => {
    vi.mocked(getHabits).mockResolvedValueOnce([
      habit({
        currentSchedule: null,
        upcomingSchedule: version(
          { type: "weekly_target", weeklyTarget: 3 },
          "2026-10-10",
        ),
      }),
    ]);
    const wrapper = mount(HabitsView);
    await flushPromises();
    expect(wrapper.text()).toContain("Geplant ab 10.10.2026");
    expect(wrapper.text()).toContain("3 Mal pro Woche");
    expect(wrapper.text()).toContain("Noch kein aktuell gültiger Zeitplan.");
    expect(
      wrapper.find('button[aria-label="Joggen bearbeiten"]').exists(),
    ).toBe(true);
  });
  it("shows current and upcoming schedules without replacing one with the other", async () => {
    vi.mocked(getHabits).mockResolvedValueOnce([
      habit({
        upcomingSchedule: version(
          { type: "weekly_target", weeklyTarget: 4 },
          "2026-10-10",
        ),
      }),
    ]);
    const wrapper = mount(HabitsView);
    await flushPromises();
    expect(wrapper.text()).toContain("Alle 2 Tage");
    expect(wrapper.text()).toContain("4 Mal pro Woche");
    expect(wrapper.text()).toContain("Aktueller Zeitplan");
  });
  it("handles a habit with no schedule", async () => {
    vi.mocked(getHabits).mockResolvedValueOnce([
      habit({ currentSchedule: null }),
    ]);
    const wrapper = mount(HabitsView);
    await flushPromises();
    expect(wrapper.text()).toContain("Noch kein Zeitplan hinterlegt.");
    expect(wrapper.get(".habit-card__status").text()).toBe("Ohne Zeitplan");
  });
  it("shows an initial load error without an empty state", async () => {
    vi.mocked(getHabits).mockRejectedValueOnce(
      new Error("Backend nicht erreichbar"),
    );
    const wrapper = mount(HabitsView);
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Backend nicht erreichbar",
    );
    expect(wrapper.text()).not.toContain("Du hast noch keine Habits.");
  });
  it("preserves loaded habits when a refresh fails", async () => {
    vi.mocked(getHabits)
      .mockResolvedValueOnce([habit()])
      .mockRejectedValueOnce(new Error("Aktualisieren fehlgeschlagen"));
    const wrapper = mount(HabitsView);
    await flushPromises();
    await wrapper.get(".habits-view__refresh").trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Aktualisieren fehlgeschlagen",
    );
    expect(wrapper.find('[data-habit-id="10"]').exists()).toBe(true);
  });
  it("opens the Habit form directly and reloads after future habit creation", async () => {
    const future = habit({
      currentSchedule: null,
      upcomingSchedule: version(
        {
          type: "interval",
          intervalDays: 1,
          missedOccurrencePolicy: "carry_over",
        },
        "2026-10-10",
      ),
    });
    vi.mocked(getHabits)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([future]);
    const wrapper = mount(HabitsView);
    await flushPromises();
    await wrapper.get('button[aria-label="Habit erstellen"]').trigger("click");
    expect(wrapper.find(".create-habit").exists()).toBe(true);
    expect(wrapper.find('[data-test="choose-todo"]').exists()).toBe(false);
    await wrapper.get('dialog input[name="title"]').setValue("Joggen");
    await wrapper.get('dialog input[name="startDate"]').setValue("2026-10-10");
    await wrapper.get("dialog form").trigger("submit");
    await flushPromises();
    expect(createHabit).toHaveBeenCalledWith({
      title: "Joggen",
      startDate: "2026-10-10",
      schedule: {
        type: "interval",
        intervalDays: 1,
        missedOccurrencePolicy: "carry_over",
      },
    });
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(getHabits).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("Geplant ab 10.10.2026");
    expect(wrapper.get('[role="status"]').text()).toBe("Habit erstellt.");
  });
  it("cancels creation without reloading", async () => {
    const wrapper = mount(HabitsView);
    await flushPromises();
    await wrapper.get(".create-button").trigger("click");
    await wrapper.get(".modal-dialog__close").trigger("click");
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(createHabit).not.toHaveBeenCalled();
    expect(getHabits).toHaveBeenCalledTimes(1);
  });
  it("reactivates a paused habit through the existing editor", async () => {
    const paused = habit({ isActive: false });
    vi.mocked(getHabits)
      .mockResolvedValueOnce([paused])
      .mockResolvedValueOnce([habit()]);
    vi.mocked(getHabit).mockResolvedValueOnce(paused);
    const wrapper = mount(HabitsView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="Joggen bearbeiten"]')
      .trigger("click");
    await flushPromises();
    expect(
      wrapper.get<HTMLInputElement>('input[name="isActive"]').element.checked,
    ).toBe(false);
    expect(
      wrapper.get<HTMLButtonElement>(".create-button").element.disabled,
    ).toBe(true);
    await wrapper.get('input[name="isActive"]').setValue(true);
    await wrapper.get(".item-editor form").trigger("submit");
    await flushPromises();
    expect(updateHabit).toHaveBeenCalledWith(10, { isActive: true });
    expect(changeHabitSchedule).not.toHaveBeenCalled();
    expect(wrapper.find(".item-editor").exists()).toBe(false);
    expect(wrapper.find('[data-group="paused"]').exists()).toBe(false);
    expect(wrapper.get('[data-group="active"]').text()).toContain("Joggen");
  });
  it("edits a planned version before the habit has started", async () => {
    const future = habit({
      currentSchedule: null,
      upcomingSchedule: version(
        { type: "weekly_target", weeklyTarget: 3 },
        "2026-10-10",
      ),
    });
    vi.mocked(getHabits).mockResolvedValue([future]);
    vi.mocked(getHabit).mockResolvedValueOnce(future);
    const wrapper = mount(HabitsView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="Joggen bearbeiten"]')
      .trigger("click");
    await flushPromises();
    await wrapper.get('[data-test="edit-upcoming"]').trigger("click");
    await wrapper.get('input[name="weeklyTarget"]').setValue("4");
    await wrapper.get(".item-editor form").trigger("submit");
    await flushPromises();
    expect(changeHabitSchedule).toHaveBeenCalledWith(10, {
      effectiveFrom: "2026-10-10",
      schedule: { type: "weekly_target", weeklyTarget: 4 },
    });
    expect(getHabits).toHaveBeenCalledTimes(2);
  });
  it("removes a habit only after confirmation and reloads the list", async () => {
    vi.mocked(getHabits)
      .mockResolvedValueOnce([habit()])
      .mockResolvedValueOnce([]);
    const wrapper = mount(HabitsView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="Joggen bearbeiten"]')
      .trigger("click");
    await flushPromises();
    await wrapper.get('[data-test="request-delete"]').trigger("click");
    expect(deleteHabit).not.toHaveBeenCalled();
    await wrapper.get('[data-test="confirm-delete"]').trigger("click");
    await flushPromises();
    expect(deleteHabit).toHaveBeenCalledWith(10);
    expect(wrapper.find('[data-habit-id="10"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("Du hast noch keine Habits.");
  });
  it("keeps the editor and list when saving fails", async () => {
    vi.mocked(getHabits).mockResolvedValue([habit()]);
    vi.mocked(updateHabit).mockRejectedValueOnce(
      new Error("Speichern fehlgeschlagen"),
    );
    const wrapper = mount(HabitsView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="Joggen bearbeiten"]')
      .trigger("click");
    await flushPromises();
    await wrapper.get('input[name="title"]').setValue("Neuer Titel");
    await wrapper.get(".item-editor form").trigger("submit");
    await flushPromises();
    expect(wrapper.get('.item-editor [role="alert"]').text()).toBe(
      "Speichern fehlgeschlagen",
    );
    expect(wrapper.find('[data-habit-id="10"]').exists()).toBe(true);
    expect(getHabits).toHaveBeenCalledTimes(1);
  });
  it("cancels editing without a write or reload", async () => {
    vi.mocked(getHabits).mockResolvedValue([habit()]);
    const wrapper = mount(HabitsView);
    await flushPromises();
    await wrapper
      .get('button[aria-label="Joggen bearbeiten"]')
      .trigger("click");
    await flushPromises();
    const button = wrapper
      .findAll(".item-editor button")
      .find((button) => button.text() === "Abbrechen");
    await button!.trigger("click");
    expect(wrapper.find(".item-editor").exists()).toBe(false);
    expect(updateHabit).not.toHaveBeenCalled();
    expect(getHabits).toHaveBeenCalledTimes(1);
  });

  it("keeps the modal locked during refresh and restores focus to the saved habit", async () => {
    vi.mocked(getHabits).mockResolvedValueOnce([habit()]);
    let finish!: (value: HabitResponse[]) => void;
    vi.mocked(getHabits).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const wrapper = mount(HabitsView, { attachTo: document.body });
    await flushPromises();
    const button = wrapper.get<HTMLButtonElement>(
      '[data-habit-id="10"] [data-edit-button]',
    );
    button.element.focus();
    await button.trigger("click");
    await flushPromises();
    expect(document.activeElement).toBe(
      wrapper.get('dialog input[name="title"]').element,
    );
    await wrapper.get('dialog input[name="title"]').setValue("Neuer Name");
    await wrapper.get("dialog form").trigger("submit");
    await flushPromises();
    expect(wrapper.find("dialog").exists()).toBe(true);
    expect(
      wrapper.get<HTMLButtonElement>(".modal-dialog__close").element.disabled,
    ).toBe(true);
    await wrapper.get("dialog form").trigger("submit");
    await flushPromises();
    expect(updateHabit).toHaveBeenCalledTimes(1);
    finish([habit({ title: "Neuer Name" })]);
    await flushPromises();
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(document.activeElement).toBe(
      wrapper.get('[data-habit-id="10"] [data-edit-button]').element,
    );
    wrapper.unmount();
  });
  it("returns focus to plus after deleting the last habit", async () => {
    vi.mocked(getHabits)
      .mockResolvedValueOnce([habit()])
      .mockResolvedValueOnce([]);
    const wrapper = mount(HabitsView, { attachTo: document.body });
    await flushPromises();
    await wrapper.get("[data-edit-button]").trigger("click");
    await flushPromises();
    await wrapper.get('[data-test="request-delete"]').trigger("click");
    await wrapper.get('[data-test="confirm-delete"]').trigger("click");
    await flushPromises();
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(document.activeElement).toBe(wrapper.get(".create-button").element);
    wrapper.unmount();
  });
  it("keeps creation open and locked until the refreshed list arrives", async () => {
    let finish!: (value: HabitResponse[]) => void;
    vi.mocked(getHabits)
      .mockReturnValueOnce(Promise.resolve([]))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
    const wrapper = mount(HabitsView, { attachTo: document.body });
    await flushPromises();
    const plus = wrapper.get<HTMLButtonElement>(".create-button");
    plus.element.focus();
    await plus.trigger("click");
    await flushPromises();
    await wrapper.get('input[name="title"]').setValue("Joggen");
    await wrapper.get("dialog form").trigger("submit");
    await flushPromises();
    expect(
      wrapper.get<HTMLButtonElement>(".modal-dialog__close").element.disabled,
    ).toBe(true);
    await wrapper.get("dialog form").trigger("submit");
    await flushPromises();
    expect(createHabit).toHaveBeenCalledTimes(1);
    finish([habit()]);
    await flushPromises();
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(document.activeElement).toBe(wrapper.get(".create-button").element);
    wrapper.unmount();
  });
});
