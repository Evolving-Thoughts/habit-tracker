import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTodo } from "../api/day-planner.api";
import type { TodoResponse } from "../types/todo";
import CreateTodoForm from "./CreateTodoForm.vue";

vi.mock("../api/day-planner.api", () => ({
  createTodo: vi.fn(),
}));

enableAutoUnmount(afterEach);

const createTodoMock = vi.mocked(createTodo);

const response: TodoResponse = {
  id: 1,
  title: "NestJS lernen",
  completed: false,
  completedAt: null,
  scheduledAt: null,
  plannedDurationMinutes: null,
  isFixed: false,
};

describe("CreateTodoForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createTodoMock.mockResolvedValue(response);
  });

  it("creates an unscheduled todo and resets the form", async () => {
    const wrapper = mount(CreateTodoForm);

    await wrapper.get('input[name="title"]').setValue("  NestJS lernen  ");

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(createTodoMock).toHaveBeenCalledWith({
      title: "NestJS lernen",
      scheduledAt: null,
      plannedDurationMinutes: null,
      isFixed: false,
    });

    expect(wrapper.emitted("created")).toEqual([[]]);

    expect(
      wrapper.get<HTMLInputElement>('input[name="title"]').element.value,
    ).toBe("");

    expect(wrapper.get('[role="status"]').text()).toContain("Todo-Dump");
  });

  it("converts a local scheduled time to ISO", async () => {
    const localDateTime = "2026-10-02T10:00";

    const wrapper = mount(CreateTodoForm);

    await wrapper.get('input[name="title"]').setValue("Arzttermin");

    await wrapper.get('input[name="scheduledAt"]').setValue(localDateTime);

    await wrapper.get('input[name="duration"]').setValue("30");

    await wrapper.get('input[name="isFixed"]').setValue(true);

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(createTodoMock).toHaveBeenCalledWith({
      title: "Arzttermin",
      scheduledAt: new Date(localDateTime).toISOString(),
      plannedDurationMinutes: 30,
      isFixed: true,
    });
  });

  it("rejects a blank title", async () => {
    const wrapper = mount(CreateTodoForm);

    await wrapper.get('input[name="title"]').setValue("   ");

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(createTodoMock).not.toHaveBeenCalled();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Bitte gib einen Titel ein.",
    );
  });

  it("rejects a fixed todo without a scheduled time", async () => {
    const wrapper = mount(CreateTodoForm);

    await wrapper.get('input[name="title"]').setValue("Arzttermin");

    await wrapper.get('input[name="isFixed"]').setValue(true);

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(createTodoMock).not.toHaveBeenCalled();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Ein fester Termin benötigt einen Zeitpunkt.",
    );
  });

  it.each(["0", "-1", "1.5"])(
    "rejects invalid duration %s",
    async (duration) => {
      const wrapper = mount(CreateTodoForm);

      await wrapper.get('input[name="title"]').setValue("Sport");

      await wrapper.get('input[name="duration"]').setValue(duration);

      await wrapper.get("form").trigger("submit");
      await flushPromises();

      expect(createTodoMock).not.toHaveBeenCalled();

      expect(wrapper.get('[role="alert"]').text()).toBe(
        "Die Dauer muss eine ganze Zahl ab 1 Minute sein.",
      );
    },
  );

  it("keeps the input when the request fails", async () => {
    createTodoMock.mockRejectedValueOnce(new Error("Backend nicht erreichbar"));

    const wrapper = mount(CreateTodoForm);

    await wrapper.get('input[name="title"]').setValue("NestJS lernen");

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Backend nicht erreichbar",
    );

    expect(
      wrapper.get<HTMLInputElement>('input[name="title"]').element.value,
    ).toBe("NestJS lernen");

    expect(wrapper.emitted("created")).toBeUndefined();

    expect(wrapper.get<HTMLFieldSetElement>("fieldset").element.disabled).toBe(
      false,
    );
  });

  it("prevents duplicate submissions while saving", async () => {
    let resolveRequest!: (value: TodoResponse) => void;

    createTodoMock.mockReturnValueOnce(
      new Promise<TodoResponse>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const wrapper = mount(CreateTodoForm);

    await wrapper.get('input[name="title"]').setValue("NestJS lernen");

    await wrapper.get("form").trigger("submit");

    expect(wrapper.get<HTMLFieldSetElement>("fieldset").element.disabled).toBe(
      true,
    );

    // Auch ein programmatisch erneut ausgelöstes
    // Submit darf keinen zweiten Request erzeugen.
    await wrapper.get("form").trigger("submit");

    expect(createTodoMock).toHaveBeenCalledTimes(1);

    resolveRequest(response);
    await flushPromises();

    expect(wrapper.get<HTMLFieldSetElement>("fieldset").element.disabled).toBe(
      false,
    );
  });
});
