import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWorkLog,
  deleteWorkLog,
  getWorkDay,
  updateWorkLog,
} from "../api/work-logs.api";
import DayWorkLogs from "./DayWorkLogs.vue";

vi.mock("../api/work-logs.api", () => ({
  getWorkDay: vi.fn(),
  createWorkLog: vi.fn(),
  updateWorkLog: vi.fn(),
  deleteWorkLog: vi.fn(),
}));
enableAutoUnmount(afterEach);

const log = {
  id: 5,
  title: "Schreiben",
  startedAt: "2026-10-30T08:00:00.000Z",
  endedAt: "2026-10-30T08:30:00.000Z",
  minutes: 30,
  source: "timer" as const,
};

async function render() {
  const wrapper = mount(DayWorkLogs, {
    props: {
      date: "2026-10-30",
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
    vi.mocked(getWorkDay).mockResolvedValue({
      date: "2026-10-30",
      totalMinutes: 30,
      logs: [log],
    });
  });

  it("shows entries in Berlin time with the day total", async () => {
    const wrapper = await render();
    expect(wrapper.text()).toContain("30 Min.");
    expect(wrapper.text()).toContain("09:00–09:30");
    expect(wrapper.text()).toContain("Timer");
  });

  it("adds a manual entry on the shown day", async () => {
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
  });

  it("corrects and deletes an entry", async () => {
    const wrapper = await render();
    await button(wrapper, "Korrigieren").trigger("click");
    const inputs = wrapper.findAll('input[aria-label="Start"]');
    await inputs[0].setValue("09:15");
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
