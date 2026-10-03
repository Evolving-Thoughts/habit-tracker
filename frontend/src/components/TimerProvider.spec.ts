import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TimerProvider from "./TimerProvider.vue";
import {
  getCurrentTimer,
  timerAction,
  changeTimerDuration,
  type TimerResponse,
} from "../api/timers.api";
import { updateTodoCompletion } from "../api/day-planner.api";
vi.mock("../api/timers.api", () => ({
  getCurrentTimer: vi.fn(),
  startTimer: vi.fn(),
  timerAction: vi.fn(),
  changeTimerDuration: vi.fn(),
}));
vi.mock("../api/day-planner.api", () => ({
  updateTodoCompletion: vi.fn(),
  updateOccurrenceStatus: vi.fn(),
}));
enableAutoUnmount(afterEach);
const response = (
  state: "running" | "paused" | "finished" = "running",
): TimerResponse => ({
  serverNow: "2026-10-03T10:00:00Z",
  timer: {
    id: "a",
    kind: "todo",
    targetId: 1,
    title: "Schreiben",
    state,
    durationMinutes: 2,
    remainingMilliseconds: state === "finished" ? 0 : 120000,
    endsAt: state === "running" ? "2026-10-03T10:02:00Z" : null,
    finishedAt: null,
  },
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentTimer).mockResolvedValue(response());
  vi.mocked(timerAction).mockResolvedValue(response("paused"));
  vi.mocked(changeTimerDuration).mockResolvedValue(response("paused"));
});
describe("global Timer bar", () => {
  it("shows countdown and icon controls, pauses and requests a stop confirmation", async () => {
    const w = mount(TimerProvider);
    await flushPromises();
    expect(w.get('[aria-label="Verbleibende Zeit"]').text()).toBe("02:00");
    await w.get('button[aria-label="Timer pausieren"]').trigger("click");
    await flushPromises();
    expect(w.text()).toContain("Pausiert");
    expect(w.find('button[aria-label="Timer fortsetzen"]').exists()).toBe(true);
    await w.get('button[aria-label="Timer stoppen"]').trigger("click");
    await flushPromises();
    expect(timerAction).toHaveBeenCalledTimes(1);
    vi.mocked(timerAction).mockResolvedValue({
      serverNow: response().serverNow,
      timer: null,
    });
    await w.get("[data-confirm-stop]").trigger("click");
    await flushPromises();
    expect(timerAction).toHaveBeenLastCalledWith("a", "stop");
    expect(w.find("aside").exists()).toBe(false);
  });
  it("validates and saves a paused duration only", async () => {
    vi.mocked(getCurrentTimer).mockResolvedValue(response("paused"));
    const w = mount(TimerProvider);
    await flushPromises();
    await w.get('button[aria-label="Timerdauer ändern"]').trigger("click");
    await flushPromises();
    await w.get('input[name="timerMinutes"]').setValue("0");
    await w.get("form").trigger("submit");
    await flushPromises();
    expect(changeTimerDuration).not.toHaveBeenCalled();
    expect(w.get('[role="alert"]').text()).toContain("1 bis 10080");
    await w.get('input[name="timerMinutes"]').setValue("3");
    await w.get("form").trigger("submit");
    await flushPromises();
    expect(changeTimerDuration).toHaveBeenCalledWith("a", 3);
    expect(w.find("dialog").exists()).toBe(false);
  });
  it("does not auto-complete when time expires", async () => {
    vi.mocked(getCurrentTimer).mockResolvedValue(response("finished"));
    const w = mount(TimerProvider);
    await flushPromises();
    expect(w.text()).toContain("Noch nicht als erledigt");
    expect(updateTodoCompletion).not.toHaveBeenCalled();
    await w.get('button[aria-label="Schreiben erledigen"]').trigger("click");
    await flushPromises();
    expect(updateTodoCompletion).toHaveBeenCalledWith(1, true);
  });
  it("polls and removes intervals/listeners after unmount", async () => {
    vi.useFakeTimers();
    const w = mount(TimerProvider);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(3000);
    expect(getCurrentTimer).toHaveBeenCalledTimes(2);
    w.unmount();
    await vi.advanceTimersByTimeAsync(6000);
    window.dispatchEvent(new Event("focus"));
    expect(getCurrentTimer).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
