import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteHabit, deleteTodo } from "../api/day-planner.api";
import { getDeletionPreview } from "../api/todo-hierarchy.api";
import DeleteItemDialog from "./DeleteItemDialog.vue";

vi.mock("../api/day-planner.api", () => ({
  deleteTodo: vi.fn(async () => undefined),
  deleteHabit: vi.fn(async () => undefined),
}));
vi.mock("../api/todo-hierarchy.api", () => ({
  getDeletionPreview: vi.fn(),
}));
enableAutoUnmount(afterEach);

const preview = {
  confirmationToken: "t".repeat(64),
  todos: [
    { id: 1, title: "Buch", parentId: null, completed: false },
    { id: 2, title: "Kapitel", parentId: 1, completed: true },
  ],
  timers: [],
};

describe("DeleteItemDialog", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getDeletionPreview).mockResolvedValue(preview);
  });

  it("shows what goes with a quest and deletes exactly that after Ja, löschen", async () => {
    const wrapper = mount(DeleteItemDialog, {
      props: {
        target: { kind: "todo", id: 1, title: "Buch" },
        returnFocus: () => null,
      },
    });
    await flushPromises();
    expect(wrapper.text()).toContain("2 Quests werden gelöscht.");
    expect(wrapper.text()).toContain("„Buch“ wirklich löschen?");
    expect(deleteTodo).not.toHaveBeenCalled();
    await wrapper.get('[data-test="confirm-delete"]').trigger("click");
    await flushPromises();
    expect(deleteTodo).toHaveBeenCalledWith(1, "t".repeat(64));
    expect(wrapper.emitted("deleted")).toEqual([[]]);
  });

  it("deletes a whole daily after saying so", async () => {
    const wrapper = mount(DeleteItemDialog, {
      props: {
        target: { kind: "habit", id: 10, title: "Joggen" },
        returnFocus: () => null,
      },
    });
    await flushPromises();
    expect(getDeletionPreview).not.toHaveBeenCalled();
    expect(wrapper.get("h2").text()).toBe("Daily löschen");
    expect(wrapper.text()).toContain("Das ganze Daily verschwindet");
    await wrapper.get('[data-test="confirm-delete"]').trigger("click");
    await flushPromises();
    expect(deleteHabit).toHaveBeenCalledWith(10);
    expect(wrapper.emitted("deleted")).toEqual([[]]);
  });

  it("closes with Nicht löschen and deletes nothing", async () => {
    const wrapper = mount(DeleteItemDialog, {
      props: {
        target: { kind: "todo", id: 1, title: "Buch" },
        returnFocus: () => null,
      },
    });
    await flushPromises();
    await wrapper.get("[data-cancel-delete]").trigger("click");
    expect(wrapper.emitted("close")).toEqual([[]]);
    expect(deleteTodo).not.toHaveBeenCalled();
  });
});
