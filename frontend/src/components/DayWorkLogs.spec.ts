import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWorkLog,
  deleteWorkLog,
  updateWorkLog,
} from "../api/work-logs.api";
import type { HistoryWorkLog } from "../types/history";
import DayWorkLogs from "./DayWorkLogs.vue";

vi.mock("../api/work-logs.api", () => ({
  createWorkLog: vi.fn(),
  updateWorkLog: vi.fn(),
  deleteWorkLog: vi.fn(),
}));
enableAutoUnmount(afterEach);

const log: HistoryWorkLog = {
  id: 5,
  title: "Schreiben",
  startedAt: "2026-10-30T08:00:00.000Z",
  endedAt: "2026-10-30T08:30:00.000Z",
  minutes: 30,
  source: "timer",
  todoId: 1,
  occurrenceId: null,
  habitId: null,
  campaign: { id: 9, title: "Buch", color: null, icon: null },
};
const reload = vi.fn(() => Promise.resolve());

async function render(logs: HistoryWorkLog[] = [log]) {
  const wrapper = mount(DayWorkLogs, {
    attachTo: document.body,
    props: {
      date: "2026-10-30",
      logs,
      reload,
      targets: [{ kind: "todo", targetId: 1, title: "Schreiben" }],
    },
  });
  await flushPromises();
  return wrapper;
}
type Wrapper = Awaited<ReturnType<typeof render>>;
const button = (wrapper: Wrapper, label: string) =>
  wrapper.findAll("button").find((item) => item.text() === label)!;
const toggle = (wrapper: Wrapper) =>
  wrapper.get('button[aria-controls="work-log-add"]');
async function openForm(wrapper: Wrapper) {
  await toggle(wrapper).trigger("click");
  await flushPromises();
}
async function fillForm(wrapper: Wrapper, from: string, to: string) {
  await wrapper.find('select[name="target"]').setValue("todo-1");
  await wrapper.find('input[name="from"]').setValue(from);
  await wrapper.find('input[name="to"]').setValue(to);
}

describe("DayWorkLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows entries in Berlin time with their campaign", async () => {
    const wrapper = await render();
    const row = wrapper.get('[aria-label="Einträge im Logbuch"] li');
    expect(row.text()).toContain("09:00–09:30");
    expect(row.text()).toContain("30 Min.");
    expect(row.text()).toContain("Stoppuhr");
    expect(row.text()).toContain("Buch");
  });

  it("adds a manual entry on the shown day and loads the day again", async () => {
    const wrapper = await render();
    await openForm(wrapper);
    await fillForm(wrapper, "10:00", "10:45");
    await button(wrapper, "Nachtragen").element.form!.requestSubmit();
    await flushPromises();
    expect(createWorkLog).toHaveBeenCalledWith(
      { kind: "todo", targetId: 1 },
      {
        startedAt: "2026-10-30T09:00:00.000Z",
        endedAt: "2026-10-30T09:45:00.000Z",
      },
    );
    expect(reload).toHaveBeenCalledWith(false);
  });

  it("corrects an entry and asks the calendar to delete one", async () => {
    const wrapper = await render();
    await button(wrapper, "Korrigieren").trigger("click");
    await flushPromises();
    const inputs = wrapper.findAll('input[aria-label="Start"]');
    await inputs[0]!.setValue("09:15");
    await wrapper.find("li form").trigger("submit");
    await flushPromises();
    expect(updateWorkLog).toHaveBeenCalledWith(5, {
      startedAt: "2026-10-30T08:15:00.000Z",
      endedAt: "2026-10-30T08:30:00.000Z",
    });
    await button(wrapper, "Löschen").trigger("click");
    await flushPromises();
    // The calendar holds the delete behind its undo toast; nothing goes yet.
    expect(wrapper.emitted("remove")).toEqual([[log]]);
    expect(deleteWorkLog).not.toHaveBeenCalled();
  });

  it("moves the focus to the next stretch when one is removed", async () => {
    const later = { ...log, id: 6, title: "Lesen" };
    const wrapper = await render([log, later]);
    await wrapper
      .get('[aria-label="Schreiben 09:00 löschen"]')
      .trigger("click");
    await wrapper.setProps({ logs: [later] });
    await flushPromises();
    expect(document.activeElement).toBe(
      wrapper.get('[data-log="6"] button').element,
    );
  });

  it("opens a stretch for correcting from outside and keeps its days", async () => {
    // 23:30 on the 29th to 00:30 on the 30th, Berlin time.
    const night = {
      ...log,
      startedAt: "2026-10-29T22:30:00.000Z",
      endedAt: "2026-10-29T23:30:00.000Z",
    };
    const wrapper = await render([night]);
    await wrapper.setProps({ editing: 5 });
    await flushPromises();
    const start = wrapper.get('input[aria-label="Start"]');
    expect((start.element as HTMLInputElement).value).toBe("23:30");
    expect(document.activeElement).toBe(start.element);
    await wrapper.get('input[aria-label="Ende"]').setValue("00:45");
    await wrapper.find("li form").trigger("submit");
    await flushPromises();
    expect(updateWorkLog).toHaveBeenCalledWith(5, {
      startedAt: "2026-10-29T22:30:00.000Z",
      endedAt: "2026-10-29T23:45:00.000Z",
    });
  });

  it("shows a refused entry and keeps what was typed", async () => {
    vi.mocked(createWorkLog).mockRejectedValueOnce(new Error("Ende vor Start"));
    const wrapper = await render();
    await openForm(wrapper);
    await fillForm(wrapper, "10:00", "09:00");
    await button(wrapper, "Nachtragen").element.form!.requestSubmit();
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toBe("Ende vor Start");
    expect(toggle(wrapper).attributes("aria-expanded")).toBe("true");
    const value = (name: string) =>
      (wrapper.get(`[name="${name}"]`).element as HTMLInputElement).value;
    expect([value("target"), value("from"), value("to")]).toEqual([
      "todo-1",
      "10:00",
      "09:00",
    ]);
  });

  it("keeps adding time behind one button that opens in place", async () => {
    const wrapper = await render();
    expect(wrapper.find("#work-log-add").exists()).toBe(false);
    expect(toggle(wrapper).text()).toBe("Zeit nachtragen");
    expect(toggle(wrapper).attributes("aria-expanded")).toBe("false");

    await openForm(wrapper);
    expect(toggle(wrapper).attributes("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(
      wrapper.get('select[name="target"]').element,
    );

    await button(wrapper, "Abbrechen").trigger("click");
    await flushPromises();
    expect(wrapper.find("#work-log-add").exists()).toBe(false);
    expect(document.activeElement).toBe(toggle(wrapper).element);

    await openForm(wrapper);
    await wrapper.get("#work-log-add").trigger("keydown", { key: "Escape" });
    await flushPromises();
    expect(wrapper.find("#work-log-add").exists()).toBe(false);
    expect(document.activeElement).toBe(toggle(wrapper).element);
  });

  it("closes again after a saved entry and gives the focus back", async () => {
    const wrapper = await render();
    await openForm(wrapper);
    await fillForm(wrapper, "10:00", "10:45");
    await button(wrapper, "Nachtragen").element.form!.requestSubmit();
    await flushPromises();
    expect(wrapper.find("#work-log-add").exists()).toBe(false);
    expect(document.activeElement).toBe(toggle(wrapper).element);
    // Opened again, the form starts empty.
    await openForm(wrapper);
    expect(
      (wrapper.get('input[name="from"]').element as HTMLInputElement).value,
    ).toBe("");
  });
});
