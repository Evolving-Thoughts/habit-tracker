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
  campaign: { id: 9, title: "Buch" },
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
const button = (wrapper: Awaited<ReturnType<typeof render>>, label: string) =>
  wrapper.findAll("button").find((item) => item.text() === label)!;

describe("DayWorkLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows entries in Berlin time with their campaign", async () => {
    const wrapper = await render();
    const row = wrapper.get('[aria-label="Einträge im Logbuch"] li');
    expect(row.text()).toContain("09:00–09:30");
    expect(row.text()).toContain("30 Min.");
    expect(row.text()).toContain("Timer");
    expect(row.text()).toContain("Buch");
  });

  it("adds a manual entry on the shown day and loads the day again", async () => {
    const wrapper = await render();
    await wrapper.find('select[name="target"]').setValue("todo-1");
    await wrapper.find('input[name="from"]').setValue("10:00");
    await wrapper.find('input[name="to"]').setValue("10:45");
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

  it("corrects and deletes an entry", async () => {
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
    expect(deleteWorkLog).toHaveBeenCalledWith(5);
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

  it("shows a refused entry", async () => {
    vi.mocked(createWorkLog).mockRejectedValueOnce(new Error("Ende vor Start"));
    const wrapper = await render();
    await wrapper.find('select[name="target"]').setValue("todo-1");
    await wrapper.find('input[name="from"]').setValue("10:00");
    await wrapper.find('input[name="to"]').setValue("09:00");
    await button(wrapper, "Nachtragen").element.form!.requestSubmit();
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toBe("Ende vor Start");
  });
});
