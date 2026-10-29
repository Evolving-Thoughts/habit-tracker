import { getDeletionPreview } from "../api/todo-hierarchy.api";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteTodo,
  createTodo,
  getBacklogTodos,
  updateTodo,
  updateTodoCompletion,
} from "../api/day-planner.api";
import type { TodoResponse } from "../types/todo";
import TodoDumpView from "./TodoDumpView.vue";

vi.mock("../api/todo-hierarchy.api", () => ({ getDeletionPreview: vi.fn() }));
vi.mock("../api/day-planner.api", () => ({
  getBacklogTodos: vi.fn(),
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
    id: 1,
    title: "NestJS lernen",
    completed: false,
    completedAt: null,
    scheduledAt: null,
    plannedDurationMinutes: 30,
    isFixed: false,
    timerEligible: true,
    ...overrides,
  };
}

function mountView() {
  return mount(TodoDumpView, {
    global: {
      stubs: {
        CreateTodoForm: true,
      },
    },
  });
}

describe("TodoDumpView", () => {
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
    expect(wrapper.text()).toContain("Heute unter Abgeschlossen");
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
    expect(wrapper.text()).not.toContain("Todos werden geladen");
    finishOld([makeTodo({ completed: true })]);
    await flushPromises();
    expect(wrapper.findAll("[data-todo-id]")).toHaveLength(1);
  });
  it("shows an empty state", async () => {
    const wrapper = mountView();

    await flushPromises();

    expect(wrapper.text()).toContain("Dein Todo-Dump ist leer.");
  });

  it("shows a loading error without an empty-state message", async () => {
    backlogMock.mockRejectedValueOnce(new Error("Backend nicht erreichbar"));

    const wrapper = mountView();

    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Backend nicht erreichbar",
    );

    expect(wrapper.text()).not.toContain("Dein Todo-Dump ist leer.");
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

  it("prefills the editor with title and duration", async () => {
    backlogMock.mockResolvedValueOnce([makeTodo()]);

    const wrapper = mountView();

    await flushPromises();

    await wrapper
      .get('button[aria-label="NestJS lernen bearbeiten"]')
      .trigger("click");

    expect(
      wrapper.get<HTMLInputElement>('input[name="editTitle"]').element.value,
    ).toBe("NestJS lernen");

    expect(
      wrapper.get<HTMLInputElement>('input[name="editDuration"]').element.value,
    ).toBe("30");
  });

  it("updates title and duration without scheduling the todo", async () => {
    backlogMock.mockResolvedValueOnce([makeTodo()]).mockResolvedValueOnce([
      makeTodo({
        title: "Vue lernen",
        plannedDurationMinutes: 45,
      }),
    ]);

    const wrapper = mountView();

    await flushPromises();

    await wrapper
      .get('button[aria-label="NestJS lernen bearbeiten"]')
      .trigger("click");

    await wrapper.get('input[name="editTitle"]').setValue("Vue lernen");

    await wrapper.get('input[name="editDuration"]').setValue("45");

    await wrapper.get('[data-test="editing-form"]').trigger("submit");

    await flushPromises();

    expect(updateTodoMock).toHaveBeenCalledWith(1, {
      title: "Vue lernen",
      scheduledAt: null,
      plannedDurationMinutes: 45,
      isFixed: false,
    });

    expect(wrapper.text()).toContain("Vue lernen");

    expect(wrapper.find('[data-test="editing-form"]').exists()).toBe(false);
  });

  it("allows clearing the duration", async () => {
    backlogMock.mockResolvedValue([makeTodo()]);

    const wrapper = mountView();

    await flushPromises();

    await wrapper
      .get('button[aria-label="NestJS lernen bearbeiten"]')
      .trigger("click");

    await wrapper.get('input[name="editDuration"]').setValue("");

    await wrapper.get('[data-test="editing-form"]').trigger("submit");

    await flushPromises();

    expect(updateTodoMock).toHaveBeenCalledWith(1, {
      title: "NestJS lernen",
      scheduledAt: null,
      plannedDurationMinutes: null,
      isFixed: false,
    });
  });

  it("schedules a todo and removes it from the dump after reload", async () => {
    const localDateTime = "2026-10-02T10:00";

    // A scheduled todo leaves the server's backlog.
    backlogMock.mockResolvedValueOnce([makeTodo()]).mockResolvedValueOnce([]);

    const wrapper = mountView();

    await flushPromises();

    await wrapper
      .get('button[aria-label="NestJS lernen bearbeiten"]')
      .trigger("click");

    await wrapper.get('input[name="editScheduledAt"]').setValue(localDateTime);

    await wrapper.get('input[name="editIsFixed"]').setValue(true);

    await wrapper.get('[data-test="editing-form"]').trigger("submit");

    await flushPromises();

    expect(updateTodoMock).toHaveBeenCalledWith(1, {
      title: "NestJS lernen",
      scheduledAt: "2026-10-02T08:00:00.000Z",
      plannedDurationMinutes: 30,
      isFixed: true,
    });

    expect(wrapper.find('[data-todo-id="1"]').exists()).toBe(false);
  });

  it("rejects a blank title", async () => {
    backlogMock.mockResolvedValueOnce([makeTodo()]);

    const wrapper = mountView();

    await flushPromises();

    await wrapper
      .get('button[aria-label="NestJS lernen bearbeiten"]')
      .trigger("click");

    await wrapper.get('input[name="editTitle"]').setValue("   ");

    await wrapper.get('[data-test="editing-form"]').trigger("submit");

    await flushPromises();

    expect(updateTodoMock).not.toHaveBeenCalled();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Bitte gib einen Titel ein.",
    );
  });

  it("rejects a fixed todo without a scheduled time", async () => {
    backlogMock.mockResolvedValueOnce([makeTodo()]);

    const wrapper = mountView();

    await flushPromises();

    await wrapper
      .get('button[aria-label="NestJS lernen bearbeiten"]')
      .trigger("click");

    await wrapper.get('input[name="editIsFixed"]').setValue(true);

    await wrapper.get('[data-test="editing-form"]').trigger("submit");

    await flushPromises();

    expect(updateTodoMock).not.toHaveBeenCalled();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Ein fester Termin benötigt einen Zeitpunkt.",
    );
  });

  it("preserves editing input when saving fails", async () => {
    backlogMock.mockResolvedValueOnce([makeTodo()]);

    updateTodoMock.mockRejectedValueOnce(new Error("Speichern fehlgeschlagen"));

    const wrapper = mountView();

    await flushPromises();

    await wrapper
      .get('button[aria-label="NestJS lernen bearbeiten"]')
      .trigger("click");

    await wrapper.get('input[name="editTitle"]').setValue("Vue lernen");

    await wrapper.get('[data-test="editing-form"]').trigger("submit");

    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Speichern fehlgeschlagen",
    );

    expect(
      wrapper.get<HTMLInputElement>('input[name="editTitle"]').element.value,
    ).toBe("Vue lernen");

    expect(backlogMock).toHaveBeenCalledTimes(1);
  });

  it("cancels editing without saving", async () => {
    backlogMock.mockResolvedValueOnce([makeTodo()]);

    const wrapper = mountView();

    await flushPromises();

    await wrapper
      .get('button[aria-label="NestJS lernen bearbeiten"]')
      .trigger("click");

    const cancelButton = wrapper
      .findAll(".todo-editor button")
      .find((button) => button.text() === "Abbrechen");

    if (!cancelButton) {
      throw new Error("Cancel button was not found");
    }

    await cancelButton.trigger("click");

    expect(updateTodoMock).not.toHaveBeenCalled();

    expect(wrapper.find('[data-test="editing-form"]').exists()).toBe(false);
  });

  it("deletes a dump todo only after confirmation", async () => {
    backlogMock.mockResolvedValueOnce([makeTodo()]).mockResolvedValueOnce([]);

    const wrapper = mountView();

    await flushPromises();

    await wrapper
      .get('button[aria-label="NestJS lernen bearbeiten"]')
      .trigger("click");

    await wrapper.get('[data-test="dump-request-delete"]').trigger("click");

    expect(deleteTodoMock).not.toHaveBeenCalled();

    await wrapper.get('[data-test="dump-confirm-delete"]').trigger("click");

    await flushPromises();

    expect(deleteTodoMock).toHaveBeenCalledWith(1, "a".repeat(64));
    expect(deleteTodoMock).toHaveBeenCalledTimes(1);

    expect(wrapper.find('[data-todo-id="1"]').exists()).toBe(false);

    expect(wrapper.find('[data-test="editing-form"]').exists()).toBe(false);

    expect(wrapper.get('[role="status"]').text()).toBe("Todo gelöscht.");
  });

  it("cancels deletion without removing the todo", async () => {
    backlogMock.mockResolvedValueOnce([makeTodo()]);

    const wrapper = mountView();

    await flushPromises();

    await wrapper
      .get('button[aria-label="NestJS lernen bearbeiten"]')
      .trigger("click");

    await wrapper.get('[data-test="dump-request-delete"]').trigger("click");

    await wrapper.get('[data-test="dump-cancel-delete"]').trigger("click");

    expect(deleteTodoMock).not.toHaveBeenCalled();

    expect(wrapper.find('[data-test="dump-confirm-delete"]').exists()).toBe(
      false,
    );

    expect(wrapper.find('[data-todo-id="1"]').exists()).toBe(true);
  });

  it("keeps the editor open when deletion fails", async () => {
    backlogMock.mockResolvedValueOnce([makeTodo()]);

    deleteTodoMock.mockRejectedValueOnce(new Error("Löschen fehlgeschlagen"));

    const wrapper = mountView();

    await flushPromises();

    await wrapper
      .get('button[aria-label="NestJS lernen bearbeiten"]')
      .trigger("click");

    await wrapper.get('[data-test="dump-request-delete"]').trigger("click");

    await wrapper.get('[data-test="dump-confirm-delete"]').trigger("click");

    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe("Löschen fehlgeschlagen");

    expect(wrapper.find('[data-test="editing-form"]').exists()).toBe(true);

    expect(wrapper.find('[data-todo-id="1"]').exists()).toBe(true);

    expect(
      wrapper.get<HTMLFieldSetElement>('[data-test="editing-form"] > fieldset')
        .element.disabled,
    ).toBe(false);

    expect(backlogMock).toHaveBeenCalledTimes(1);
  });
});

describe("TodoDumpView creation flow", () => {
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
    vi.mocked(createTodo).mockResolvedValue(makeTodo());
  });
  it("opens the Todo form directly without a Habit choice", async () => {
    const wrapper = mount(TodoDumpView);
    await flushPromises();
    expect(wrapper.find(".create-todo").exists()).toBe(false);
    await wrapper.get('button[aria-label="Todo erstellen"]').trigger("click");
    expect(wrapper.find("dialog .create-todo").exists()).toBe(true);
    expect(wrapper.find('[data-test="choose-habit"]').exists()).toBe(false);
  });
  it("closes on creation, reloads the dump and shows the created Todo", async () => {
    backlogMock.mockResolvedValueOnce([]).mockResolvedValueOnce([makeTodo()]);
    const wrapper = mount(TodoDumpView);
    await flushPromises();
    await wrapper.get('button[aria-label="Todo erstellen"]').trigger("click");
    await wrapper.get('dialog input[name="title"]').setValue("NestJS lernen");
    await wrapper.get("dialog form").trigger("submit");
    await flushPromises();
    expect(createTodo).toHaveBeenCalledWith({
      title: "NestJS lernen",
      scheduledAt: null,
      plannedDurationMinutes: null,
      isFixed: false,
    });
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(backlogMock).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("NestJS lernen");
    expect(wrapper.get('[role="status"]').text()).toContain("Todo erstellt");
  });
  it("cancels without creating or reloading", async () => {
    const wrapper = mount(TodoDumpView);
    await flushPromises();
    await wrapper.get('button[aria-label="Todo erstellen"]').trigger("click");
    await wrapper.get(".modal-dialog__close").trigger("click");
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(createTodo).not.toHaveBeenCalled();
    expect(backlogMock).toHaveBeenCalledTimes(1);
  });

  it("opens a focused modal and returns to the row on cancel", async () => {
    backlogMock.mockResolvedValueOnce([makeTodo()]);
    const wrapper = mount(TodoDumpView, { attachTo: document.body });
    await flushPromises();
    const button = wrapper.get<HTMLButtonElement>("[data-edit-button]");
    button.element.focus();
    await button.trigger("click");
    await flushPromises();
    expect(document.activeElement).toBe(
      wrapper.get('dialog input[name="editTitle"]').element,
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
        makeTodo({ id: 2, title: "Zweites Todo" }),
      ])
      .mockResolvedValueOnce([makeTodo({ id: 2, title: "Zweites Todo" })]);
    const wrapper = mount(TodoDumpView, { attachTo: document.body });
    await flushPromises();
    await wrapper.get('[data-todo-id="1"] [data-edit-button]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-test="dump-request-delete"]').trigger("click");
    await wrapper.get('[data-test="dump-confirm-delete"]').trigger("click");
    await flushPromises();
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(document.activeElement).toBe(
      wrapper.get('[data-todo-id="2"] [data-edit-button]').element,
    );
    wrapper.unmount();
  });
});
