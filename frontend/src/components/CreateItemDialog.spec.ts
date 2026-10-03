import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHabit, createTodo } from "../api/day-planner.api";
import type { HabitResponse } from "../types/habit";
import CreateItemDialog from "./CreateItemDialog.vue";
vi.mock("../api/day-planner.api", () => ({
  createHabit: vi.fn(),
  createTodo: vi.fn(),
}));
enableAutoUnmount(afterEach);
const habit: HabitResponse = {
  id: 10,
  title: "Joggen",
  isActive: true,
  plannedDurationMinutes: null,
  timerOccurrenceId: null,
  timerDurationMinutes: null,
  currentSchedule: null,
  upcomingSchedule: null,
};
describe("CreateItemDialog", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createHabit).mockResolvedValue(habit);
    vi.mocked(createTodo).mockResolvedValue({
      id: 1,
      title: "Test",
      completed: false,
      completedAt: null,
      scheduledAt: null,
      plannedDurationMinutes: null,
      isFixed: false,
    });
  });
  it("opens Today with a choice and no creation form", async () => {
    const wrapper = mount(CreateItemDialog, { props: { mode: "choose" } });
    await flushPromises();
    expect(wrapper.get("dialog").attributes("open")).toBeDefined();
    expect(wrapper.findAll('[data-test^="choose-"]')).toHaveLength(2);
    expect(wrapper.find("form").exists()).toBe(false);
  });
  it.each(["todo", "habit"] as const)(
    "opens the %s form and can return to the choice",
    async (kind) => {
      const wrapper = mount(CreateItemDialog, { props: { mode: "choose" } });
      await wrapper.get(`[data-test="choose-${kind}"]`).trigger("click");
      expect(wrapper.find(`.create-${kind}`).exists()).toBe(true);
      expect(wrapper.find(`[data-test="choose-${kind}"]`).exists()).toBe(false);
      await wrapper.get(".create-dialog__footer button").trigger("click");
      expect(wrapper.find("form").exists()).toBe(false);
      expect(wrapper.find('[data-test="choose-todo"]').exists()).toBe(true);
    },
  );
  it("opens the Todo-Dump directly in Todo mode without habit choice", async () => {
    const wrapper = mount(CreateItemDialog, { props: { mode: "todo" } });
    await flushPromises();
    expect(wrapper.find(".create-todo").exists()).toBe(true);
    expect(wrapper.find('[data-test="choose-habit"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Zurück zur Auswahl");
  });
  it("focuses the title input and restores the opener after unmount", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const wrapper = mount(CreateItemDialog, {
      props: { mode: "todo" },
      attachTo: document.body,
    });
    await flushPromises();
    expect(document.activeElement).toBe(
      wrapper.get('input[name="title"]').element,
    );
    wrapper.unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
  it("cancels without creating an entity", async () => {
    const wrapper = mount(CreateItemDialog, { props: { mode: "todo" } });
    await wrapper.get(".create-dialog__footer button").trigger("click");
    expect(wrapper.emitted("close")).toEqual([[]]);
    expect(createTodo).not.toHaveBeenCalled();
    expect(createHabit).not.toHaveBeenCalled();
  });
  it("closes on Escape's cancel event when idle", async () => {
    const wrapper = mount(CreateItemDialog, { props: { mode: "choose" } });
    await wrapper.get("dialog").trigger("cancel");
    expect(wrapper.emitted("close")).toEqual([[]]);
  });
  it("blocks closing and navigation during a pending creation", async () => {
    let resolve!: (value: HabitResponse) => void;
    vi.mocked(createHabit).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const wrapper = mount(CreateItemDialog, { props: { mode: "choose" } });
    await wrapper.get('[data-test="choose-habit"]').trigger("click");
    await wrapper.get('input[name="title"]').setValue("Joggen");
    await wrapper.get("form").trigger("submit");
    expect(
      wrapper.get<HTMLButtonElement>(".modal-dialog__close").element.disabled,
    ).toBe(true);
    for (const button of wrapper.findAll<HTMLButtonElement>(
      ".create-dialog__footer button",
    ))
      expect(button.element.disabled).toBe(true);
    await wrapper.get("dialog").trigger("cancel");
    expect(wrapper.emitted("close")).toBeUndefined();
    resolve(habit);
    await flushPromises();
    expect(wrapper.emitted("created")).toEqual([["habit"]]);
  });
  it("keeps the form and input when creation fails", async () => {
    vi.mocked(createTodo).mockRejectedValueOnce(
      new Error("Speichern fehlgeschlagen"),
    );
    const wrapper = mount(CreateItemDialog, { props: { mode: "todo" } });
    await wrapper.get('input[name="title"]').setValue("Test");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Speichern fehlgeschlagen",
    );
    expect(
      wrapper.get<HTMLInputElement>('input[name="title"]').element.value,
    ).toBe("Test");
    expect(wrapper.emitted("created")).toBeUndefined();
    expect(
      wrapper.get<HTMLButtonElement>(".modal-dialog__close").element.disabled,
    ).toBe(false);
  });
});

it("opens Habit management directly in Habit mode without a Todo choice", async () => {
  const wrapper = mount(CreateItemDialog, { props: { mode: "habit" } });
  await flushPromises();
  expect(wrapper.find(".create-habit").exists()).toBe(true);
  expect(wrapper.find('[data-test="choose-todo"]').exists()).toBe(false);
  expect(wrapper.text()).not.toContain("Zurück zur Auswahl");
});
