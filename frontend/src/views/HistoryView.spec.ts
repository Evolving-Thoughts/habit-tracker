import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getHistory } from "../api/history.api";
import { getCurrentDateInTimeZone } from "../utils/date";
import type { HistoryItem, HistoryResponse } from "../types/history";
import HistoryView from "./HistoryView.vue";
vi.mock("../api/history.api", () => ({ getHistory: vi.fn() }));
enableAutoUnmount(afterEach);
const mock = vi.mocked(getHistory);
function item(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    type: "todo",
    id: 1,
    habitId: null,
    title: "Artikel",
    status: "completed",
    date: "2026-10-07",
    scheduledDate: null,
    resolvedAt: "2026-10-07T12:32:00Z",
    plannedDurationMinutes: 30,
    deleted: false,
    ...overrides,
  };
}
function response(items: HistoryItem[] = []): HistoryResponse {
  return {
    today: "2026-10-07",
    timeZone: "Europe/Berlin",
    startDate: "2026-10-07",
    endDate: "2026-10-07",
    days: [{ date: "2026-10-07", items }],
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.mockResolvedValue(response());
});
describe("HistoryView", () => {
  it("requests the current Berlin day", async () => {
    mount(HistoryView);
    await flushPromises();
    expect(mock).toHaveBeenCalledWith(
      getCurrentDateInTimeZone(),
      "day",
      "all",
      expect.any(AbortSignal),
    );
  });
  it("shows loading while waiting", async () => {
    mock.mockImplementation(() => new Promise(() => {}));
    const w = mount(HistoryView);
    expect(w.get('[role="status"]').text()).toContain("geladen");
  });
  it("shows an empty state without a timer or edit action", async () => {
    const w = mount(HistoryView);
    await flushPromises();
    expect(w.text()).toContain("keine Einträge");
    expect(w.find("[data-history-key]").exists()).toBe(false);
    expect(w.find(".create-button").exists()).toBe(false);
  });
  it("groups completed and skipped separately with deleted marker and late planned date", async () => {
    mock.mockResolvedValue(
      response([
        item({ deleted: true }),
        item({
          type: "habit",
          id: 2,
          habitId: 3,
          title: "Joggen",
          scheduledDate: "2026-10-05",
        }),
        item({
          type: "habit",
          id: 3,
          habitId: 4,
          title: "Putzen",
          status: "skipped",
          scheduledDate: "2026-10-07",
          resolvedAt: null,
        }),
      ]),
    );
    const w = mount(HistoryView);
    await flushPromises();
    expect(w.get('section[aria-label="Erledigt"]').findAll("li")).toHaveLength(
      2,
    );
    expect(
      w.get('section[aria-label="Übersprungen"]').findAll("li"),
    ).toHaveLength(1);
    expect(w.text()).toContain("Gelöscht");
    expect(w.text()).toContain("Aus dem Todo-Dump");
    expect(w.text()).toContain("14:32");
    expect(w.text()).toContain("Geplant für 05.10.2026");
    expect(w.text()).toContain("Geplant: 30 Min.");
  });
  it("does not invent an older Habit's completion time", async () => {
    mock.mockResolvedValue(
      response([item({ type: "habit", resolvedAt: null })]),
    );
    const w = mount(HistoryView);
    await flushPromises();
    expect(w.text()).not.toContain("Erledigt um");
  });
  it("passes selected filter and date", async () => {
    const w = mount(HistoryView);
    await flushPromises();
    await w.get('[name="historyDate"]').setValue("2026-10-05");
    await w.get('[name="historyFilter"]').setValue("habits");
    await flushPromises();
    expect(mock).toHaveBeenLastCalledWith(
      "2026-10-05",
      "day",
      "habits",
      expect.any(AbortSignal),
    );
  });
  it("moves one day or seven days and returns to today", async () => {
    const w = mount(HistoryView);
    await flushPromises();
    await w.get('[name="historyDate"]').setValue("2026-10-07");
    await w.get('[aria-label="Vorheriger Zeitraum"]').trigger("click");
    await flushPromises();
    expect(mock).toHaveBeenLastCalledWith(
      "2026-10-06",
      "day",
      "all",
      expect.any(AbortSignal),
    );
    await w.findAll(".mode button")[1]!.trigger("click");
    await w.get('[aria-label="Nächster Zeitraum"]').trigger("click");
    await flushPromises();
    expect(mock).toHaveBeenLastCalledWith(
      "2026-10-13",
      "week",
      "all",
      expect.any(AbortSignal),
    );
    await w.findAll(".period-controls button")[1]!.trigger("click");
    await flushPromises();
    expect(mock).toHaveBeenLastCalledWith(
      getCurrentDateInTimeZone(),
      "week",
      "all",
      expect.any(AbortSignal),
    );
  });
  it("renders seven expandable week days with separate counts", async () => {
    const week = response();
    week.startDate = "2026-10-05";
    week.endDate = "2026-10-11";
    week.days = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-10-${String(i + 5).padStart(2, "0")}`,
      items:
        i === 2
          ? [
              item(),
              item({
                type: "habit",
                id: 2,
                status: "skipped",
                resolvedAt: null,
              }),
            ]
          : [],
    }));
    mock.mockResolvedValue(week);
    const w = mount(HistoryView);
    await flushPromises();
    await w.findAll(".mode button")[1]!.trigger("click");
    await flushPromises();
    expect(w.findAll("details")).toHaveLength(7);
    expect(w.text()).toContain("05.10.2026 – 11.10.2026");
    expect(w.findAll("summary")[2]!.text()).toContain(
      "1 Todo erledigt · 0 Habits erledigt · 1 übersprungen",
    );
    await w.findAll("details button")[2]!.trigger("click");
    await flushPromises();
    expect(mock).toHaveBeenLastCalledWith(
      "2026-10-07",
      "day",
      "all",
      expect.any(AbortSignal),
    );
  });
  it("shows a failure and retries", async () => {
    mock.mockRejectedValueOnce(new Error("Backend nicht erreichbar"));
    const w = mount(HistoryView);
    await flushPromises();
    expect(w.get('[role="alert"]').text()).toContain(
      "Backend nicht erreichbar",
    );
    await w.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(w.find('[role="alert"]').exists()).toBe(false);
  });
  it("ignores an older response after a newer selection", async () => {
    let resolve!: (value: HistoryResponse) => void;
    mock.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const w = mount(HistoryView);
    await w.get('[name="historyDate"]').setValue("2026-10-08");
    await flushPromises();
    resolve(response([item({ title: "Stale" })]));
    await flushPromises();
    expect(w.text()).not.toContain("Stale");
  });
  it("cancels requests on unmount", async () => {
    const w = mount(HistoryView);
    const signal = mock.mock.calls[0]![3]!;
    w.unmount();
    expect(signal.aborted).toBe(true);
  });
  it("handles an empty date without a request or render error", async () => {
    const w = mount(HistoryView);
    await flushPromises();
    const count = mock.mock.calls.length;
    await w.get('[name="historyDate"]').setValue("");
    await flushPromises();
    expect(mock).toHaveBeenCalledTimes(count);
    expect(w.get('[role="alert"]').text()).toContain("gültiges Datum");
  });
});
