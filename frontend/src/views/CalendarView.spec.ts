import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getHistory } from "../api/history.api";
import type { HistoryResponse } from "../types/history";
import CalendarView from "./CalendarView.vue";

vi.mock("../api/history.api", () => ({ getHistory: vi.fn() }));
vi.mock("../api/day-planner.api", () => ({
  rescheduleTodo: vi.fn(),
  rescheduleOccurrence: vi.fn(),
}));
enableAutoUnmount(afterEach);
afterEach(() => vi.useRealTimers());

const planned = {
  type: "todo" as const,
  habitId: null,
  date: "2026-10-30",
  scheduledDate: "2026-10-30",
  isOverdue: false,
  plannedDurationMinutes: null,
};
const response: HistoryResponse = {
  today: "2026-10-30",
  timeZone: "Europe/Berlin",
  startDate: "2026-10-01",
  endDate: "2026-10-31",
  days: Array.from({ length: 31 }, (_, index) => {
    const date = `2026-10-${String(index + 1).padStart(2, "0")}`;
    return {
      date,
      items: [],
      planned:
        date === "2026-10-30"
          ? [
              { ...planned, key: "todo:1", id: 1, title: "Saugen" },
              {
                ...planned,
                key: "habit:1:x",
                type: "habit" as const,
                id: null,
                habitId: 3,
                title: "Laufen",
              },
            ]
          : [],
    };
  }),
};

async function render() {
  const wrapper = mount(CalendarView, {
    global: { stubs: { ModalDialog: { template: "<div><slot /></div>" } } },
  });
  await flushPromises();
  return wrapper;
}

describe("CalendarView", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
    vi.mocked(getHistory).mockResolvedValue(response);
  });

  it("loads the month read-only and starts on the right weekday", async () => {
    const wrapper = await render();
    expect(getHistory).toHaveBeenCalledWith(
      "2026-10-01",
      "month",
      "all",
      expect.anything(),
    );
    expect(wrapper.text()).toContain("Oktober 2026");
    // 1 October 2026 is a Thursday: three blanks after the weekday heads.
    expect(wrapper.findAll(".calendar-grid > span")).toHaveLength(10);
    expect(wrapper.findAll(".calendar-day")).toHaveLength(31);
  });

  it("marks forecasts and offers moving only for stored entries", async () => {
    const wrapper = await render();
    const rows = wrapper.findAll(".calendar-entries li");
    expect(rows[0].text()).toContain("Saugen");
    expect(rows[0].find("button").exists()).toBe(true);
    expect(rows[1].text()).toContain("Prognose");
    expect(rows[1].find("button").exists()).toBe(false);
  });

  it("opens the move dialog for a planned entry", async () => {
    const wrapper = await render();
    await wrapper.find(".calendar-entries li button").trigger("click");
    expect(wrapper.text()).toContain("Morgen");
  });

  it("changes the month", async () => {
    const wrapper = await render();
    await wrapper.find('[aria-label="Nächster Monat"]').trigger("click");
    await flushPromises();
    expect(getHistory).toHaveBeenLastCalledWith(
      "2026-11-01",
      "month",
      "all",
      expect.anything(),
    );
  });
});
