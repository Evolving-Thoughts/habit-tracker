import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateWorkLog } from "../api/work-logs.api";
import { notifyDataChanged } from "../composables/data-sync";
import { useViewSession } from "../composables/useViewSession";
import { HISTORY_ITEM_FIELDS } from "../types/fixtures";
import type { HistoryResponse } from "../types/history";
import DayCalendar from "./DayCalendar.vue";

vi.mock("../api/work-logs.api", () => ({
  createWorkLog: vi.fn(),
  updateWorkLog: vi.fn(),
  deleteWorkLog: vi.fn(),
}));
enableAutoUnmount(afterEach);

type Day = HistoryResponse["days"][number];
const DATE = "2026-10-07";
const PX_PER_MINUTE = (4 * 16) / 60;

const day: Day = {
  date: DATE,
  items: [
    {
      ...HISTORY_ITEM_FIELDS,
      type: "todo",
      id: 4,
      habitId: null,
      title: "Kapitel",
      status: "completed",
      date: DATE,
      scheduledDate: DATE,
      resolvedAt: "2026-10-07T09:00:00.000Z",
      plannedDurationMinutes: null,
      timeOfDay: null,
      deleted: false,
    },
  ],
  work: {
    minutes: 30,
    campaigns: [],
    logs: [
      {
        id: 1,
        title: "Kapitel",
        // 10:00–10:30 in Berlin (summer time).
        startedAt: "2026-10-07T08:00:00.000Z",
        endedAt: "2026-10-07T08:30:00.000Z",
        minutes: 30,
        source: "timer",
        todoId: 4,
        occurrenceId: null,
        habitId: null,
        campaign: null,
      },
    ],
  },
};

/* A view with one resource (the day) that draws it in a DayCalendar. */
function renderView() {
  const load = vi.fn(() => Promise.resolve(day));
  const wrapper = mount(
    defineComponent({
      setup() {
        const session = useViewSession();
        const shown = session.resource(load, {
          initial: null as Day | null,
          fallbackError: "Der Tag konnte nicht geladen werden.",
        });
        return () =>
          shown.data.value
            ? h(DayCalendar, { day: shown.data.value, today: DATE })
            : null;
      },
    }),
    {
      attachTo: document.body,
      global: { stubs: { ModalDialog: { template: "<div><slot /></div>" } } },
    },
  );
  return { wrapper, load };
}
type Wrapper = ReturnType<typeof renderView>["wrapper"];
const button = (wrapper: Wrapper, label: string) =>
  wrapper.findAll("button").find((item) => item.text() === label)!;

describe("DayCalendar in its view's session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 14:00 in Berlin.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T12:00:00.000Z"));
    vi.mocked(updateWorkLog).mockResolvedValue(undefined as never);
  });
  afterEach(() => vi.useRealTimers());

  it("reloads the view exactly once after a dragged edge is saved", async () => {
    const { wrapper, load } = renderView();
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(1);
    const handle = wrapper.get(".log-handle--end");
    await handle.trigger("pointerdown", {
      button: 0,
      pointerId: 1,
      clientY: 100,
    });
    await handle.trigger("pointermove", {
      pointerId: 1,
      clientY: 100 + 30 * PX_PER_MINUTE,
    });
    await handle.trigger("pointerup", { pointerId: 1 });
    await flushPromises();
    expect(updateWorkLog).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("reloads the view exactly once after the dialog saves", async () => {
    const { wrapper, load } = renderView();
    await flushPromises();
    await wrapper.get("button.log-block").trigger("click");
    await wrapper.get('input[name="end"]').setValue("11:00");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(updateWorkLog).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(2);
    expect(wrapper.find("form").exists()).toBe(false);
  });

  it("holds the view's reload while its dialog is open, then loads once", async () => {
    const { wrapper, load } = renderView();
    await flushPromises();
    await wrapper.get("button.log-block").trigger("click");
    notifyDataChanged();
    notifyDataChanged();
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(1);
    await button(wrapper, "Abbrechen").trigger("click");
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
