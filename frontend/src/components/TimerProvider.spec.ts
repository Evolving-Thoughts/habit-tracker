import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TimerProvider from "./TimerProvider.vue";
import {
  getCurrentTimer,
  timerAction,
  changeTimerTarget,
  type TimerResponse,
} from "../api/timers.api";
import { updateTodoCompletion } from "../api/day-planner.api";
vi.mock("../api/timers.api", () => ({
  getCurrentTimer: vi.fn(),
  startTimer: vi.fn(),
  timerAction: vi.fn(),
  changeTimerTarget: vi.fn(),
}));
vi.mock("../api/day-planner.api", () => ({
  updateTodoCompletion: vi.fn(),
  updateOccurrenceStatus: vi.fn(),
}));
enableAutoUnmount(afterEach);
const response = (
  state: "running" | "paused" = "running",
  elapsedMilliseconds = 65_000,
  targetMinutes: number | null = 2,
): TimerResponse => ({
  serverNow: "2026-10-03T10:00:00Z",
  timer: {
    id: "a",
    kind: "todo",
    targetId: 1,
    title: "Schreiben",
    state,
    elapsedMilliseconds,
    targetMinutes,
    targetReachedAt: null,
  },
});
const none: TimerResponse = { serverNow: response().serverNow, timer: null };
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(performance, "now").mockReturnValue(1000);
  vi.mocked(getCurrentTimer).mockResolvedValue(response());
  vi.mocked(timerAction).mockResolvedValue(response("paused"));
  vi.mocked(changeTimerTarget).mockResolvedValue(response("paused"));
});
afterEach(() => vi.restoreAllMocks());
describe("global Timer bar", () => {
  it("shows the time worked against the target, pauses and ends without asking", async () => {
    const w = mount(TimerProvider);
    await flushPromises();
    expect(w.get('[aria-label="Gearbeitete Zeit"]').text()).toBe("01:05");
    expect(w.get(".timer-bar__target").text()).toBe("von 2 Min.");
    expect(w.text()).toContain("Stoppuhr läuft");
    await w.get('button[aria-label="Timer pausieren"]').trigger("click");
    await flushPromises();
    expect(w.text()).toContain("Pausiert");
    expect(w.find('button[aria-label="Timer fortsetzen"]').exists()).toBe(true);
    vi.mocked(timerAction).mockResolvedValue(none);
    await w.get('button[aria-label="Timer beenden"]').trigger("click");
    await flushPromises();
    // The work is logged either way, so ending needs no confirmation.
    expect(timerAction).toHaveBeenLastCalledWith("a", "stop");
    expect(w.find("aside").exists()).toBe(false);
  });
  it("shows no target for a quest without planned minutes", async () => {
    vi.mocked(getCurrentTimer).mockResolvedValue(
      response("running", 5_000, null),
    );
    const w = mount(TimerProvider);
    await flushPromises();
    expect(w.find(".timer-bar__target").exists()).toBe(false);
    expect(w.text()).not.toContain("Soll erreicht");
  });
  it("says when the target is reached and keeps counting", async () => {
    vi.mocked(getCurrentTimer).mockResolvedValue(response("running", 119_000));
    const w = mount(TimerProvider);
    await flushPromises();
    expect(w.find(".timer-bar__hint").exists()).toBe(false);
    vi.mocked(performance.now).mockReturnValue(4000);
    await vi.waitFor(() => expect(w.text()).toContain("Soll erreicht"), {
      timeout: 2000,
    });
    expect(w.get('[role="status"]').text()).toContain(
      "Die Stoppuhr läuft weiter",
    );
    expect(w.get('[aria-label="Gearbeitete Zeit"]').text()).toBe("02:02");
    expect(updateTodoCompletion).not.toHaveBeenCalled();
  });
  it("validates and saves a new target, also while running", async () => {
    const w = mount(TimerProvider);
    await flushPromises();
    await w.get('button[aria-label="Soll ändern"]').trigger("click");
    await flushPromises();
    expect(
      w.get<HTMLInputElement>('input[name="timerMinutes"]').element.value,
    ).toBe("2");
    await w.get('input[name="timerMinutes"]').setValue("0");
    await w.get("form").trigger("submit");
    await flushPromises();
    expect(changeTimerTarget).not.toHaveBeenCalled();
    expect(w.get('[role="alert"]').text()).toContain("1 bis 10080");
    await w.get('input[name="timerMinutes"]').setValue("3");
    await w.get("form").trigger("submit");
    await flushPromises();
    expect(changeTimerTarget).toHaveBeenCalledWith("a", 3);
    expect(w.find("dialog").exists()).toBe(false);
  });
  it("completes the quest from the bar at any time", async () => {
    const w = mount(TimerProvider);
    await flushPromises();
    vi.mocked(getCurrentTimer).mockResolvedValue(none);
    await w.get('button[aria-label="Schreiben erledigen"]').trigger("click");
    await flushPromises();
    expect(updateTodoCompletion).toHaveBeenCalledWith(1, true);
    expect(w.find("aside").exists()).toBe(false);
  });
  it("hides the bar where a view shows the stopwatch itself, but keeps its dialogs", async () => {
    const w = mount(TimerProvider, { props: { hideBar: true } });
    await flushPromises();
    expect(w.find("aside").exists()).toBe(false);
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
