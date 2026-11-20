import { TODO_FIELDS } from "../types/fixtures";
import {
  getDeletionPreview,
  getTodoHierarchy,
} from "../api/todo-hierarchy.api";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteTodo,
  createTodo,
  getTodo,
  getBacklogTodos,
  reorderBacklog,
  updateTodo,
  updateTodoCompletion,
} from "../api/day-planner.api";
import type { TodoResponse } from "../types/todo";
import { getCategories } from "../api/categories.api";
import { choose } from "../test/combobox";
import { hierarchyTodo } from "../test/hierarchy";
import QuestlogView from "./QuestlogView.vue";
import { reloadShortcutSettings } from "../composables/useShortcuts";

vi.mock("../api/categories.api", () => ({ getCategories: vi.fn() }));
vi.mock("../components/QuestNotes.vue", () => import("../test/quest-notes-stub"));
vi.mock("../api/todo-hierarchy.api", () => ({
  getDeletionPreview: vi.fn(),
  getTodoHierarchy: vi.fn(async () => []),
}));
vi.mock("../api/day-planner.api", () => ({
  getTodo: vi.fn(),
  getBacklogTodos: vi.fn(),
  reorderBacklog: vi.fn(),
  createTodo: vi.fn(),
  updateTodo: vi.fn(),
  updateTodoCompletion: vi.fn(),
  deleteTodo: vi.fn(),
}));

enableAutoUnmount(afterEach);

const backlogMock = vi.mocked(getBacklogTodos);
const updateTodoMock = vi.mocked(updateTodo);
const completionMock = vi.mocked(updateTodoCompletion);
const deleteTodoMock = vi.mocked(deleteTodo);

function makeTodo(overrides: Partial<TodoResponse> = {}): TodoResponse {
  return {
    ...TODO_FIELDS,
    id: 1,
    parentId: null,
    title: "NestJS lernen",
    completed: false,
    completedAt: null,
    scheduledDate: null,
    timeOfDay: null,
    plannedDurationMinutes: 30,
    timerEligible: true,
    ...overrides,
  };
}

function mountView() {
  return mount(QuestlogView, {
    global: {
      stubs: {
        CreateTodoForm: true,
      },
    },
  });
}

describe("QuestlogView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getDeletionPreview).mockResolvedValue({
      confirmationToken: "a".repeat(64),
      todos: [
        { id: 1, title: "NestJS lernen", parentId: null, completed: false },
      ],
      timers: [],
    });

    backlogMock.mockResolvedValue([]);
    vi.mocked(getCategories).mockResolvedValue([]);
    vi.mocked(getTodo).mockResolvedValue(makeTodo());
    completionMock.mockResolvedValue(undefined);
    updateTodoMock.mockResolvedValue(makeTodo());
    deleteTodoMock.mockResolvedValue(undefined);
  });

  it("shows the server's backlog (open todos without a date)", async () => {
    backlogMock.mockResolvedValueOnce([makeTodo()]);

    const wrapper = mountView();

    await flushPromises();

    expect(backlogMock).toHaveBeenCalled();
    expect(wrapper.text()).toContain("NestJS lernen");
    expect(wrapper.findAll("[data-todo-id]")).toHaveLength(1);
  });

  it("removes a newly completed todo after reloading the backlog", async () => {
    backlogMock.mockResolvedValueOnce([makeTodo()]).mockResolvedValueOnce([]);
    const wrapper = mountView();
    await flushPromises();
    await wrapper
      .get('button[aria-label="NestJS lernen erledigen"]')
      .trigger("click");
    await flushPromises();
    expect(wrapper.findAll("[data-todo-id]")).toHaveLength(0);
    expect(wrapper.get(".undo-toast").text()).toContain(
      "„NestJS lernen“ erledigt",
    );
  });

  /*
   * The server leaves campaigns and Questreihen with open quests out of the
   * Questlog (todo-agenda.ts), so a tick here never needs to ask first.
   */
  it("completes a row at once without reading the tree", async () => {
    backlogMock.mockResolvedValue([
      makeTodo({
        campaign: { id: 9, title: "Buch schreiben", color: null, icon: null },
      }),
    ]);
    const wrapper = mountView();
    await flushPromises();
    await wrapper
      .get('button[aria-label="NestJS lernen erledigen"]')
      .trigger("click");
    await flushPromises();
    expect(getTodoHierarchy).not.toHaveBeenCalled();
    expect(wrapper.find(".campaign-completion__lead").exists()).toBe(false);
    expect(completionMock).toHaveBeenCalledWith(1, true);
  });

  it("folds ticked todos under a disclosure and can reopen them", async () => {
    backlogMock
      .mockResolvedValueOnce([makeTodo()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeTodo()]);
    const wrapper = mountView();
    await flushPromises();
    await wrapper
      .get('button[aria-label="NestJS lernen erledigen"]')
      .trigger("click");
    await flushPromises();
    const toggle = wrapper.get(".dump-done__toggle");
    expect(toggle.text()).toBe("1 erledigt");
    expect(toggle.attributes("aria-expanded")).toBe("false");
    await toggle.trigger("click");
    expect(toggle.attributes("aria-expanded")).toBe("true");
    await wrapper
      .get('#dump-done-list button[aria-label="NestJS lernen wieder öffnen"]')
      .trigger("click");
    await flushPromises();
    expect(completionMock).toHaveBeenLastCalledWith(1, false);
    expect(wrapper.find(".dump-done__toggle").exists()).toBe(false);
    expect(wrapper.findAll("[data-todo-id]")).toHaveLength(1);
  });

  it("takes a tick back from the undo toast", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    backlogMock
      .mockResolvedValueOnce([makeTodo()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeTodo()]);
    const wrapper = mountView();
    await flushPromises();
    await wrapper
      .get('button[aria-label="NestJS lernen erledigen"]')
      .trigger("click");
    await flushPromises();
    await wrapper.get(".undo-toast button").trigger("click");
    await flushPromises();
    expect(completionMock).toHaveBeenLastCalledWith(1, false);
    expect(wrapper.find(".undo-toast button").exists()).toBe(false);
    expect(wrapper.find(".dump-done__toggle").exists()).toBe(false);
    expect(wrapper.findAll("[data-todo-id]")).toHaveLength(1);
    vi.useRealTimers();
  });

  it("hides the undo toast after five seconds", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    backlogMock.mockResolvedValueOnce([makeTodo()]).mockResolvedValueOnce([]);
    const wrapper = mountView();
    await flushPromises();
    await wrapper
      .get('button[aria-label="NestJS lernen erledigen"]')
      .trigger("click");
    await flushPromises();
    expect(wrapper.find(".undo-toast button").exists()).toBe(true);
    vi.advanceTimersByTime(5000);
    await flushPromises();
    expect(wrapper.find(".undo-toast button").exists()).toBe(false);
    vi.useRealTimers();
  });

  it("shows category, duration and why without repeating the type", async () => {
    vi.mocked(getCategories).mockResolvedValue([{ id: 4, name: "Lernen" }]);
    backlogMock.mockResolvedValueOnce([
      makeTodo({ categoryId: 4, why: "Für das neue Projekt" }),
    ]);
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.get(".dump-item__why").text()).toBe("Für das neue Projekt");
    expect(wrapper.get(".item-row__meta").text()).toBe("Lernen30 Min.");
    expect(wrapper.get(".dump-item").text()).not.toContain("Quest");
    expect(
      wrapper
        .get('h3[aria-label="NestJS lernen"] button[data-edit-button]')
        .attributes("aria-label"),
    ).toBe("NestJS lernen bearbeiten");
  });

  it("offers a retry when loading fails", async () => {
    backlogMock
      .mockRejectedValueOnce(new Error("Backend nicht erreichbar"))
      .mockResolvedValueOnce([makeTodo()]);
    const wrapper = mountView();
    await flushPromises();
    await wrapper.get(".alert button").trigger("click");
    await flushPromises();
    expect(wrapper.find(".alert").exists()).toBe(false);
    expect(wrapper.findAll("[data-todo-id]")).toHaveLength(1);
  });

  it("keeps the latest refreshed state when an older initial read settles later", async () => {
    let finishOld!: (value: TodoResponse[]) => void;
    backlogMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishOld = resolve;
        }),
      )
      .mockResolvedValueOnce([makeTodo()]);
    const wrapper = mountView();
    await flushPromises();
    window.dispatchEvent(new Event("timer-data-changed"));
    await flushPromises();
    expect(wrapper.findAll("[data-todo-id]")).toHaveLength(1);
    expect(wrapper.find(".skeleton").exists()).toBe(false);
    finishOld([makeTodo({ completed: true })]);
    await flushPromises();
    expect(wrapper.findAll("[data-todo-id]")).toHaveLength(1);
  });
  it("shows an empty state", async () => {
    const wrapper = mountView();

    await flushPromises();

    expect(wrapper.text()).toContain("Dein Questlog ist leer.");
  });

  it("shows a loading error without an empty-state message", async () => {
    backlogMock.mockRejectedValueOnce(new Error("Backend nicht erreichbar"));

    const wrapper = mountView();

    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Backend nicht erreichbar",
    );

    expect(wrapper.text()).not.toContain("Dein Questlog ist leer.");
  });

  it.each([[false, true, "erledigen"]] as const)(
    "changes completion from %s to %s",
    async (completed, target, action) => {
      backlogMock.mockResolvedValue([makeTodo({ completed })]);

      const wrapper = mountView();

      await flushPromises();

      const button = wrapper.get(
        `button[aria-label="NestJS lernen ${action}"]`,
      );

      expect(button.attributes("aria-pressed")).toBe(String(completed));

      await button.trigger("click");
      await flushPromises();

      expect(completionMock).toHaveBeenCalledWith(1, target);

      expect(backlogMock).toHaveBeenCalledTimes(2);
    },
  );

  /*
   * The Questlog edits with the shared editor (PlannerItemEditor has its
   * own spec); here only that it opens, saves and deletes like elsewhere.
   */
  it("edits in the shared editor with Warum, Gehört zu, Kategorie and notes", async () => {
    backlogMock.mockResolvedValue([makeTodo()]);
    const wrapper = mountView();
    await flushPromises();
    await wrapper
      .get('button[aria-label="NestJS lernen bearbeiten"]')
      .trigger("click");
    await flushPromises();
    const dialog = wrapper.get("dialog");
    expect(dialog.get("h2").text()).toBe("Quest bearbeiten");
    for (const field of [
      "#planner-edit-parent",
      'textarea[name="why"]',
      "#planner-edit-category",
      "[data-notes]",
    ])
      expect(dialog.find(field).exists()).toBe(true);
    await dialog.get('input[name="title"]').setValue("NestJS meistern");
    await dialog.get("form").trigger("submit");
    await flushPromises();
    expect(updateTodoMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ title: "NestJS meistern" }),
    );
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(backlogMock).toHaveBeenCalledTimes(2);
    expect(wrapper.get(".questlog__status").text()).toBe(
      "Änderungen gespeichert.",
    );
  });

  it("deletes from the row's menu after the same confirmation as the editor", async () => {
    backlogMock
      .mockResolvedValueOnce([makeTodo()])
      .mockResolvedValueOnce([]);
    const wrapper = mountView();
    await flushPromises();
    await wrapper
      .get('[aria-label="Aktionen für NestJS lernen"]')
      .trigger("click");
    await wrapper.get('[aria-label="NestJS lernen löschen"]').trigger("click");
    await flushPromises();
    expect(deleteTodoMock).not.toHaveBeenCalled();
    expect(wrapper.get("dialog").text()).toContain("1 Quest wird gelöscht.");
    await wrapper.get('[data-test="confirm-delete"]').trigger("click");
    await flushPromises();
    expect(deleteTodoMock).toHaveBeenCalledWith(1, "a".repeat(64));
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(wrapper.get(".questlog__status").text()).toBe("Quest gelöscht.");
  });

  it("moves a quest into a campaign from the row's menu", async () => {
    backlogMock.mockResolvedValue([makeTodo()]);
    vi.mocked(getTodoHierarchy).mockResolvedValue([
      hierarchyTodo({ id: 9, title: "Buch", color: "berry" }),
    ]);
    const wrapper = mountView();
    await flushPromises();
    await wrapper
      .get('[aria-label="Aktionen für NestJS lernen"]')
      .trigger("click");
    await wrapper
      .get('[aria-label="NestJS lernen in eine Kampagne verschieben"]')
      .trigger("click");
    await flushPromises();
    await choose(wrapper, "#campaign-move-parent", "Buch");
    await wrapper.get("dialog form").trigger("submit");
    await flushPromises();
    expect(updateTodoMock).toHaveBeenCalledWith(1, { parentId: 9 });
    expect(wrapper.get(".questlog__status").text()).toBe("Quest verschoben.");
  });
});

describe("QuestlogView creation flow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getDeletionPreview).mockResolvedValue({
      confirmationToken: "a".repeat(64),
      todos: [
        { id: 1, title: "NestJS lernen", parentId: null, completed: false },
      ],
      timers: [],
    });
    backlogMock.mockResolvedValue([]);
    vi.mocked(getCategories).mockResolvedValue([]);
    vi.mocked(createTodo).mockResolvedValue(makeTodo());
    vi.mocked(getTodo).mockResolvedValue(makeTodo());
    vi.mocked(getTodoHierarchy).mockResolvedValue([]);
  });
  it("opens on the Quest form", async () => {
    const wrapper = mount(QuestlogView);
    await flushPromises();
    expect(wrapper.find(".create-todo").exists()).toBe(false);
    await wrapper.get('button[aria-label="Quest erstellen"]').trigger("click");
    expect(wrapper.find("dialog .create-todo").exists()).toBe(true);
  });
  it("closes on creation, reloads the dump and shows the created Quest", async () => {
    backlogMock.mockResolvedValueOnce([]).mockResolvedValueOnce([makeTodo()]);
    const wrapper = mount(QuestlogView);
    await flushPromises();
    await wrapper.get('button[aria-label="Quest erstellen"]').trigger("click");
    await wrapper.get('dialog input[name="title"]').setValue("NestJS lernen");
    await wrapper.get("dialog form").trigger("submit");
    await flushPromises();
    expect(createTodo).toHaveBeenCalledWith({
      title: "NestJS lernen",
      scheduledDate: null,
      timeOfDay: null,
      plannedDurationMinutes: null,
      parentId: null,
      categoryId: null,
    });
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(backlogMock).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("NestJS lernen");
    expect(wrapper.get('[role="status"]').text()).toContain("Quest erstellt");
  });
  it("cancels without creating or reloading", async () => {
    const wrapper = mount(QuestlogView);
    await flushPromises();
    await wrapper.get('button[aria-label="Quest erstellen"]').trigger("click");
    await wrapper.get(".modal-dialog__close").trigger("click");
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(createTodo).not.toHaveBeenCalled();
    expect(backlogMock).toHaveBeenCalledTimes(1);
  });

  it("opens a focused modal and returns to the row on cancel", async () => {
    backlogMock.mockResolvedValueOnce([makeTodo()]);
    const wrapper = mount(QuestlogView, { attachTo: document.body });
    await flushPromises();
    const button = wrapper.get<HTMLButtonElement>("[data-edit-button]");
    button.element.focus();
    await button.trigger("click");
    await flushPromises();
    expect(document.activeElement).toBe(
      wrapper.get('dialog input[name="title"]').element,
    );
    await wrapper.get(".modal-dialog__close").trigger("click");
    await flushPromises();
    expect(document.activeElement).toBe(
      wrapper.get('[data-todo-id="1"] [data-edit-button]').element,
    );
    expect(updateTodoMock).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it("returns to the neighbouring edit button after deletion", async () => {
    backlogMock
      .mockResolvedValueOnce([
        makeTodo(),
        makeTodo({ id: 2, title: "Zweites Quest" }),
      ])
      .mockResolvedValueOnce([makeTodo({ id: 2, title: "Zweites Quest" })]);
    const wrapper = mount(QuestlogView, { attachTo: document.body });
    await flushPromises();
    await wrapper.get('[data-todo-id="1"] [data-edit-button]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-test="request-delete"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-test="confirm-delete"]').trigger("click");
    await flushPromises();
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(document.activeElement).toBe(
      wrapper.get('[data-todo-id="2"] [data-edit-button]').element,
    );
    wrapper.unmount();
  });
});

describe("QuestlogView keyboard shortcuts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    // Friday, 2 Oct 2026, 08:00 in Berlin.
    vi.setSystemTime(new Date("2026-10-02T06:00:00Z"));
    localStorage.clear();
    reloadShortcutSettings();
    vi.mocked(getCategories).mockResolvedValue([]);
    backlogMock.mockResolvedValue([
      makeTodo({ id: 1, title: "Steuer" }),
      makeTodo({ id: 2, title: "Fahrrad", plannedDurationMinutes: null }),
    ]);
    completionMock.mockResolvedValue(undefined);
    updateTodoMock.mockResolvedValue(makeTodo());
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  async function mountAttached() {
    const wrapper = mount(QuestlogView, {
      attachTo: document.body,
      global: { stubs: { CreateTodoForm: true } },
    });
    await flushPromises();
    return wrapper;
  }
  function hover(key: string): void {
    document
      .querySelector(`[data-focus-key="${key}"]`)!
      .dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  }
  function press(key: string) {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(event);
    return event;
  }

  it("ticks the hovered quest with X and offers undo", async () => {
    const wrapper = await mountAttached();
    hover("todo-2");
    press("x");
    await flushPromises();
    expect(completionMock).toHaveBeenCalledWith(2, true);
    expect(wrapper.get(".undo-toast").text()).toContain("„Fahrrad“ erledigt");
  });

  it("plans the hovered quest for tomorrow with D, as saving a day would", async () => {
    const wrapper = await mountAttached();
    hover("todo-2");
    press("d");
    await flushPromises();
    expect(updateTodoMock).toHaveBeenCalledWith(2, {
      title: "Fahrrad",
      scheduledDate: "2026-10-03",
      timeOfDay: null,
      plannedDurationMinutes: null,
    });
    expect(wrapper.get(".questlog__status").text()).toBe(
      "„Fahrrad“ steht jetzt bei morgen.",
    );
  });

  it("plans for today with T and for next Monday with W", async () => {
    await mountAttached();
    hover("todo-1");
    press("t");
    await flushPromises();
    hover("todo-1");
    press("w");
    await flushPromises();
    expect(
      updateTodoMock.mock.calls.map(([id, input]) => [id, input.scheduledDate]),
    ).toEqual([
      [1, "2026-10-02"],
      [1, "2026-10-05"],
    ]);
  });

  it("opens the quest dialog with N", async () => {
    const wrapper = await mountAttached();
    press("n");
    await flushPromises();
    expect(wrapper.find("dialog").exists()).toBe(true);
  });
});

describe("QuestlogView Einplanen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    // Friday, 2 Oct 2026, 08:00 in Berlin.
    vi.setSystemTime(new Date("2026-10-02T06:00:00Z"));
    localStorage.clear();
    reloadShortcutSettings();
    vi.mocked(getCategories).mockResolvedValue([]);
    backlogMock.mockResolvedValue([
      makeTodo({
        id: 1,
        title: "Steuer",
        campaign: { id: 9, title: "Ordnung", color: "slate", icon: null },
      }),
      makeTodo({ id: 2, title: "Fahrrad", plannedDurationMinutes: null }),
    ]);
    completionMock.mockResolvedValue(undefined);
    updateTodoMock.mockResolvedValue(makeTodo());
    vi.mocked(getTodo).mockResolvedValue(makeTodo({ id: 1, title: "Steuer" }));
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  async function mountAttached() {
    const wrapper = mount(QuestlogView, {
      attachTo: document.body,
      global: { stubs: { CreateTodoForm: true } },
    });
    await flushPromises();
    return wrapper;
  }
  const labels = (wrapper: ReturnType<typeof mount>) =>
    wrapper
      .findAll("[role=menuitem] .action-menu__label")
      .map((label) => label.text());

  it("puts Einplanen into each row's menu and plans like T, D and W", async () => {
    const wrapper = await mountAttached();
    await wrapper.get('[aria-label="Aktionen für Fahrrad"]').trigger("click");
    expect(labels(wrapper)).toEqual([
      "Heute",
      "Morgen",
      "Nächste Woche",
      "Anderer Tag …",
      "Bearbeiten",
      "In Kampagne verschieben …",
      "Nach oben",
      "Löschen",
    ]);
    await wrapper
      .get('[aria-label="Fahrrad einplanen für morgen"]')
      .trigger("click");
    await flushPromises();
    expect(updateTodoMock).toHaveBeenCalledWith(2, {
      title: "Fahrrad",
      scheduledDate: "2026-10-03",
      timeOfDay: null,
      plannedDurationMinutes: null,
    });
    expect(wrapper.get(".questlog__status").text()).toBe(
      "„Fahrrad“ steht jetzt bei morgen.",
    );

    await wrapper.get('[aria-label="Aktionen für Steuer"]').trigger("click");
    await wrapper
      .get('[aria-label="Steuer einplanen für nächste Woche"]')
      .trigger("click");
    await flushPromises();
    expect(updateTodoMock).toHaveBeenLastCalledWith(
      1,
      expect.objectContaining({ scheduledDate: "2026-10-05" }),
    );
  });

  it("keeps the order it is sorted into: Nach unten in the menu, or dragging the whole card", async () => {
    vi.mocked(reorderBacklog).mockResolvedValue(undefined);
    const wrapper = await mountAttached();
    expect(
      wrapper.get('[data-focus-key="todo-1"] .item-row').classes(),
    ).toContain("card-drag");
    backlogMock.mockResolvedValue([
      makeTodo({ id: 2, title: "Fahrrad", plannedDurationMinutes: null }),
      makeTodo({ id: 1, title: "Steuer" }),
    ]);

    await wrapper.get('[aria-label="Aktionen für Steuer"]').trigger("click");
    expect(labels(wrapper)).toContain("Nach unten");
    expect(labels(wrapper)).not.toContain("Nach oben");
    await wrapper.get('[aria-label="Steuer nach unten"]').trigger("click");
    await flushPromises();

    expect(reorderBacklog).toHaveBeenCalledWith([2, 1]);
    expect(
      wrapper.findAll("[data-todo-id]").map((row) => row.attributes("data-todo-id")),
    ).toEqual(["2", "1"]);
    expect(wrapper.get(".questlog__status").text()).toBe(
      "„Steuer“ steht jetzt an Stelle 2 von 2.",
    );
    expect(document.activeElement).toBe(
      wrapper.get('[aria-label="Aktionen für Steuer"]').element,
    );
  });

  it("takes a failed sort back and says why", async () => {
    vi.mocked(reorderBacklog).mockRejectedValueOnce(new Error("Offline"));
    const wrapper = await mountAttached();
    await wrapper.get('[aria-label="Aktionen für Fahrrad"]').trigger("click");
    await wrapper.get('[aria-label="Fahrrad nach oben"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("Offline");
    expect(
      wrapper.findAll("[data-todo-id]").map((row) => row.attributes("data-todo-id")),
    ).toEqual(["1", "2"]);
  });

  it("opens the editor at its day field for Anderer Tag …", async () => {
    const wrapper = await mountAttached();
    await wrapper.get('[aria-label="Aktionen für Steuer"]').trigger("click");
    await wrapper.get('[aria-label="Tag für Steuer wählen"]').trigger("click");
    await flushPromises();
    expect(wrapper.find("dialog.edit-dialog").exists()).toBe(true);
    expect(document.activeElement?.getAttribute("name")).toBe("scheduledDate");
  });

  it("shows each quest's campaign as a stripe and as a chip in the meta line", async () => {
    const wrapper = await mountAttached();
    const row = wrapper.get('[data-focus-key="todo-1"] .item-row');
    expect(row.classes()).toContain("item-row--campaign");
    expect(row.attributes("style")).toContain(
      "--campaign-mark: var(--color-mark-slate)",
    );
    expect(row.get(".campaign-chip__name").text()).toBe("Ordnung");
    expect(
      wrapper.find('[data-focus-key="todo-2"] .item-row--campaign').exists(),
    ).toBe(false);
  });
});
