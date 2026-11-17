import { TODO_FIELDS } from "../types/fixtures";
import { mount, flushPromises, enableAutoUnmount } from "@vue/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import TodoHierarchyView from "./TodoHierarchyView.vue";
import {
  getTodoHierarchy,
  getDeletionPreview,
} from "../api/todo-hierarchy.api";
import {
  updateTodo,
  updateTodoCompletion,
  deleteTodo,
} from "../api/day-planner.api";
import { getCategories } from "../api/categories.api";
import type { HierarchyTodo } from "../types/todo-hierarchy";
vi.mock("../api/todo-hierarchy.api", () => ({
  getTodoHierarchy: vi.fn(),
  getDeletionPreview: vi.fn(),
}));
vi.mock("../api/categories.api", () => ({
  getCategories: vi.fn(),
}));
vi.mock("../api/day-planner.api", () => ({
  updateTodo: vi.fn(),
  updateTodoCompletion: vi.fn(),
  deleteTodo: vi.fn(),
}));
enableAutoUnmount(afterEach);
const node = (id: number, parentId: number | null): HierarchyTodo => ({
  ...TODO_FIELDS,
  id,
  parentId,
  title: `Todo ${id}`,
  completed: false,
  timerEligible: true,
  completedAt: null,
  scheduledAt: null,
  plannedDurationMinutes: 30,
  isFixed: false,
  progress: {
    mode: "duration",
    completed: 0,
    total: 30,
    percentage: 0,
    knownDurationMinutes: 30,
    todoCount: 1,
  },
});
const button = (w: ReturnType<typeof mount>, text: string) =>
  w.findAll("button").find((b) => b.text() === text)!;
const openMenu = (w: ReturnType<typeof mount>, title: string) =>
  w.get(`[aria-label="Aktionen für ${title}"][aria-haspopup]`).trigger("click");
const view = () =>
  mount(TodoHierarchyView, {
    global: {
      stubs: {
        ModalDialog: { template: '<section role="dialog"><slot /></section>' },
        PlannerItemEditor: true,
        CreateTodoForm: true,
      },
    },
  });
describe("TodoHierarchyView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getTodoHierarchy).mockResolvedValue([node(1, null), node(2, 1)]);
    vi.mocked(getCategories).mockResolvedValue([]);
    vi.mocked(updateTodo).mockResolvedValue(node(1, null));
    vi.mocked(updateTodoCompletion).mockResolvedValue();
    vi.mocked(deleteTodo).mockResolvedValue();
    vi.mocked(getDeletionPreview).mockResolvedValue({
      confirmationToken: "a".repeat(64),
      todos: [node(1, null), node(2, 1)],
      timers: [{ id: "timer", todoId: 2, title: "Todo 2", state: "paused" }],
    });
  });
  it("renders independent checkboxes, progress and hierarchy depth", async () => {
    const w = view();
    await flushPromises();
    expect(w.findAll("[data-todo-id]")).toHaveLength(2);
    expect(w.get('[data-todo-id="2"]').attributes("data-depth")).toBe("1");
    expect(w.get('[data-todo-id="2"]').text()).toContain("Teilaufgabe von");
    expect(w.findAll("[role=checkbox]")).toHaveLength(2);
    // Only todos with sub-tasks show a progress bar; leaves stay calm.
    expect(w.findAll("[role=progressbar]")).toHaveLength(1);
    expect(w.get('[data-todo-id="1"]').text()).toContain("0/30 Min.");
    expect(w.get('[data-todo-id="2"]').find(".row__progress").exists()).toBe(
      false,
    );
  });
  it("gives leaves no expander and names the category", async () => {
    vi.mocked(getCategories).mockResolvedValue([
      { id: 7, name: "Lernen" } as never,
    ]);
    vi.mocked(getTodoHierarchy).mockResolvedValue([
      { ...node(1, null), categoryId: 7, why: "Für den Job" },
    ]);
    const w = view();
    await flushPromises();
    expect(w.find('[aria-label="Todo 1 einklappen"]').exists()).toBe(false);
    expect(w.text()).toContain("Lernen");
    expect(w.text()).toContain("Für den Job");
  });
  it("keeps row actions behind one menu that Escape closes", async () => {
    const w = view();
    await flushPromises();
    expect(w.find('[aria-label="Todo 1 verschieben"]').exists()).toBe(false);
    await openMenu(w, "Todo 1");
    const trigger = w.get('[data-menu-trigger="1"]');
    expect(trigger.attributes("aria-expanded")).toBe("true");
    const menu = w.get("#todo-menu-1");
    const heading = w.get(`#${menu.attributes("aria-labelledby")}`);
    expect(heading.text()).toBe("Todo 1");
    expect(
      w.get('[aria-label="Todo 1 mit allen Teilaufgaben löschen"]').classes(),
    ).not.toContain("btn--danger");
    expect(
      w.findAll("#todo-menu-1 [role=menuitem]").map((b) => b.text()),
    ).toEqual([
      "Timer starten",
      "Teilaufgabe hinzufügen",
      "Fortschritt anzeigen",
      "Verschieben",
      "Löschen",
    ]);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(w.find("#todo-menu-1").exists()).toBe(false);
  });
  it("collapses and expands without changing data", async () => {
    const w = view();
    await flushPromises();
    await w.get('[aria-label="Todo 1 einklappen"]').trigger("click");
    expect(w.findAll("[data-todo-id]")).toHaveLength(1);
    await w.get('[aria-label="Todo 1 ausklappen"]').trigger("click");
    expect(w.findAll("[data-todo-id]")).toHaveLength(2);
  });
  it("toggles only the selected Todo and reloads computed progress", async () => {
    const w = view();
    await flushPromises();
    await w.get("[role=checkbox]").trigger("click");
    await flushPromises();
    expect(updateTodoCompletion).toHaveBeenCalledWith(1, true);
    expect(getTodoHierarchy).toHaveBeenCalledTimes(2);
  });
  it("excludes self and descendants from move choices and allows root", async () => {
    const w = view();
    await flushPromises();
    await openMenu(w, "Todo 1");
    await w.get('[aria-label="Todo 1 verschieben"]').trigger("click");
    expect(w.findAll("select option")).toHaveLength(1);
    await w.get("form").trigger("submit");
    await flushPromises();
    expect(updateTodo).toHaveBeenCalledWith(1, { parentId: null });
  });
  it("does not delete when preview is cancelled and shows active/paused timers", async () => {
    const w = view();
    await flushPromises();
    await openMenu(w, "Todo 1");
    await w
      .get('[aria-label="Todo 1 mit allen Teilaufgaben löschen"]')
      .trigger("click");
    await flushPromises();
    expect(w.text()).toContain("pausiert");
    await w.get("[data-cancel-delete]").trigger("click");
    expect(deleteTodo).not.toHaveBeenCalled();
  });
  it("confirms exactly the reviewed snapshot", async () => {
    const w = view();
    await flushPromises();
    await openMenu(w, "Todo 1");
    await w
      .get('[aria-label="Todo 1 mit allen Teilaufgaben löschen"]')
      .trigger("click");
    await flushPromises();
    await button(w, "Ja, löschen").trigger("click");
    await flushPromises();
    expect(deleteTodo).toHaveBeenCalledWith(1, "a".repeat(64));
  });
  it("requires a fresh preview after a stale snapshot error", async () => {
    vi.mocked(deleteTodo).mockRejectedValueOnce(new Error("Preview changed"));
    const w = view();
    await flushPromises();
    await openMenu(w, "Todo 1");
    await w
      .get('[aria-label="Todo 1 mit allen Teilaufgaben löschen"]')
      .trigger("click");
    await flushPromises();
    await button(w, "Ja, löschen").trigger("click");
    await flushPromises();
    expect(w.get("[role=alert]").text()).toContain("Preview changed");
    expect(w.find("[role=dialog]").exists()).toBe(false);
  });
  it("offers retry for load errors", async () => {
    vi.mocked(getTodoHierarchy).mockRejectedValueOnce(new Error("Offline"));
    const w = view();
    await flushPromises();
    expect(w.get("[role=alert]").text()).toContain("Offline");
    await button(w, "Erneut versuchen").trigger("click");
    await flushPromises();
    expect(w.findAll("[data-todo-id]")).toHaveLength(2);
  });
  it("shows the empty state", async () => {
    vi.mocked(getTodoHierarchy).mockResolvedValue([]);
    const w = view();
    await flushPromises();
    expect(w.get(".empty-state").text()).toContain("Noch keine Ziele.");
    expect(w.get(".empty-state").text()).toContain("Plus-Button");
  });
  it("creates through the shared plus button", async () => {
    const w = view();
    await flushPromises();
    const plus = w.get(".create-button");
    expect(plus.attributes("aria-label")).toBe("Neue Aufgabe");
    expect(w.find(".page-header button").exists()).toBe(false);
    await plus.trigger("click");
    expect(w.find("[role=dialog]").exists()).toBe(true);
  });
});
