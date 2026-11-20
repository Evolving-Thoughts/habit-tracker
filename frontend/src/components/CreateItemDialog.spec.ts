import { TODO_FIELDS, HABIT_FIELDS } from "../types/fixtures";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHabit, createTodo } from "../api/day-planner.api";
import type { HabitResponse } from "../types/habit";
import CreateItemDialog from "./CreateItemDialog.vue";
vi.mock("../api/day-planner.api", () => ({
  createHabit: vi.fn(),
  createTodo: vi.fn(),
}));
vi.mock("../api/categories.api", () => ({
  getCategories: vi.fn(async () => []),
  createCategory: vi.fn(),
}));
vi.mock("../api/todo-hierarchy.api", () => ({
  getTodoHierarchy: vi.fn(async () => []),
}));
enableAutoUnmount(afterEach);
const habit: HabitResponse = {
  ...HABIT_FIELDS,
  id: 10,
  title: "Joggen",
  isActive: true,
  plannedDurationMinutes: null,
  timerOccurrenceId: null,
  timerDurationMinutes: null,
  currentSchedule: null,
  upcomingSchedule: null,
};
const cancel = (wrapper: ReturnType<typeof mount>) =>
  wrapper
    .findAll("button")
    .find((button) => button.text() === "Abbrechen")!
    .trigger("click");
describe("CreateItemDialog", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createHabit).mockResolvedValue(habit);
    vi.mocked(createTodo).mockResolvedValue({
      ...TODO_FIELDS,
      id: 1,
      parentId: null,
      title: "Test",
      completed: false,
      completedAt: null,
      scheduledDate: null,
      timeOfDay: null,
      plannedDurationMinutes: null,
      timerEligible: true,
    });
  });
  it("opens on the quest form with Quest | Daily on top", async () => {
    const wrapper = mount(CreateItemDialog);
    await flushPromises();
    expect(wrapper.get("dialog").attributes("open")).toBeDefined();
    expect(wrapper.get('[role="radiogroup"]').text()).toBe("Quest  Daily");
    expect(
      wrapper.get<HTMLInputElement>('[data-test="kind-todo"]').element.checked,
    ).toBe(true);
    expect(wrapper.find(".create-todo").exists()).toBe(true);
    expect(wrapper.get("h2").text()).toBe("Neue Quest");
  });
  it("swaps the form and keeps what was typed in each", async () => {
    const wrapper = mount(CreateItemDialog);
    await flushPromises();
    await wrapper.get('input[name="title"]').setValue("Lesen");
    await wrapper.get('[data-test="kind-habit"]').setValue(true);
    expect(wrapper.find(".create-habit").exists()).toBe(true);
    expect(wrapper.find(".create-todo").exists()).toBe(false);
    expect(wrapper.get("h2").text()).toBe("Neues Daily");
    await wrapper.get('[data-test="kind-todo"]').setValue(true);
    expect(
      wrapper.get<HTMLInputElement>('input[name="title"]').element.value,
    ).toBe("Lesen");
    expect(createTodo).not.toHaveBeenCalled();
  });
  it("opens on the daily form when asked to", async () => {
    const wrapper = mount(CreateItemDialog, { props: { kind: "habit" } });
    await flushPromises();
    expect(wrapper.find(".create-habit").exists()).toBe(true);
  });
  it("keeps the actions as the last part of the dialog", async () => {
    const wrapper = mount(CreateItemDialog);
    await flushPromises();
    const content = wrapper.get(".modal-dialog__content").element;
    const footer = wrapper.get(".sticky-actions").element;
    // Nothing follows the sticky actions, so nothing shows below them.
    let node: Element | null = footer;
    while (node && node !== content) {
      expect(node.nextElementSibling).toBeNull();
      node = node.parentElement;
    }
  });
  it("focuses the title input and restores the opener after unmount", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const wrapper = mount(CreateItemDialog, { attachTo: document.body });
    await flushPromises();
    expect(document.activeElement).toBe(
      wrapper.get('input[name="title"]').element,
    );
    wrapper.unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
  it("cancels without creating an entity", async () => {
    const wrapper = mount(CreateItemDialog);
    await flushPromises();
    await cancel(wrapper);
    expect(wrapper.emitted("close")).toEqual([[]]);
    expect(createTodo).not.toHaveBeenCalled();
    expect(createHabit).not.toHaveBeenCalled();
  });
  it("closes on Escape's cancel event when idle", async () => {
    const wrapper = mount(CreateItemDialog);
    await wrapper.get("dialog").trigger("cancel");
    expect(wrapper.emitted("close")).toEqual([[]]);
  });
  it("blocks closing during a pending creation", async () => {
    let resolve!: (value: HabitResponse) => void;
    vi.mocked(createHabit).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const wrapper = mount(CreateItemDialog, { props: { kind: "habit" } });
    await flushPromises();
    await wrapper.get('input[name="title"]').setValue("Joggen");
    await wrapper.get("form").trigger("submit");
    expect(
      wrapper.get<HTMLButtonElement>(".modal-dialog__close").element.disabled,
    ).toBe(true);
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
    const wrapper = mount(CreateItemDialog);
    await flushPromises();
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
