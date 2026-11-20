import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkLog, updateWorkLog } from "../api/work-logs.api";
import type { HistoryWorkLog } from "../types/history";
import WorkLogDialog from "./WorkLogDialog.vue";

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
const targets = [
  { kind: "todo" as const, targetId: 1, title: "Schreiben" },
  { kind: "occurrence" as const, targetId: 7, title: "Lesen" },
];

function render(props: Record<string, unknown> = {}) {
  return mount(WorkLogDialog, {
    attachTo: document.body,
    props: { date: "2026-10-30", reload, ...props },
    global: { stubs: { ModalDialog: { template: "<div><slot /></div>" } } },
  });
}
type Wrapper = ReturnType<typeof render>;
const button = (wrapper: Wrapper, label: string) =>
  wrapper.findAll("button").find((item) => item.text() === label)!;
const value = (wrapper: Wrapper, name: string) =>
  (wrapper.get(`[name="${name}"]`).element as HTMLInputElement).value;

describe("WorkLogDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds a stretch on the shown day, prefilled where it was asked for", async () => {
    const wrapper = render({ targets, from: "10:00", to: "10:30" });
    expect([value(wrapper, "from"), value(wrapper, "to")]).toEqual([
      "10:00",
      "10:30",
    ]);
    expect(button(wrapper, "Nachtragen").attributes("disabled")).toBeDefined();
    await wrapper.get('select[name="target"]').setValue("todo-1");
    await wrapper.get('input[name="to"]').setValue("10:45");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(createWorkLog).toHaveBeenCalledWith(
      { kind: "todo", targetId: 1 },
      {
        startedAt: "2026-10-30T09:00:00.000Z",
        endedAt: "2026-10-30T09:45:00.000Z",
      },
    );
    expect(reload).toHaveBeenCalledWith(false);
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("shows a refused stretch and keeps what was typed", async () => {
    vi.mocked(createWorkLog).mockRejectedValueOnce(new Error("Ende vor Start"));
    const wrapper = render({ targets });
    await wrapper.get('select[name="target"]').setValue("occurrence-7");
    await wrapper.get('input[name="from"]').setValue("10:00");
    await wrapper.get('input[name="to"]').setValue("09:00");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("Ende vor Start");
    expect(wrapper.emitted("close")).toBeUndefined();
    expect(
      ["target", "from", "to"].map((name) => value(wrapper, name)),
    ).toEqual(["occurrence-7", "10:00", "09:00"]);
  });

  it("corrects a stretch and keeps the days it covers", async () => {
    // 23:30 on the 29th to 00:30 on the 30th, Berlin time.
    const night = {
      ...log,
      startedAt: "2026-10-29T22:30:00.000Z",
      endedAt: "2026-10-29T23:30:00.000Z",
    };
    const wrapper = render({ log: night });
    expect(wrapper.text()).toContain("Schreiben");
    expect(wrapper.text()).toContain("Stoppuhr");
    expect(value(wrapper, "start")).toBe("23:30");
    await wrapper.get('input[name="end"]').setValue("00:45");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(updateWorkLog).toHaveBeenCalledWith(5, {
      startedAt: "2026-10-29T22:30:00.000Z",
      endedAt: "2026-10-29T23:45:00.000Z",
    });
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("asks the host to delete a stretch; nothing goes from here", async () => {
    const wrapper = render({ log });
    await button(wrapper, "Löschen").trigger("click");
    expect(wrapper.emitted("remove")).toEqual([[log]]);
    expect(wrapper.emitted("close")).toHaveLength(1);
    expect(updateWorkLog).not.toHaveBeenCalled();
  });
});
