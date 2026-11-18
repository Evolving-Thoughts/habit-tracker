import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTimerController, toggleTimer } from "./useTimer";
import {
  getCurrentTimer,
  startTimer,
  timerAction,
  changeTimerTarget,
  type TimerResponse,
} from "../api/timers.api";
import { ApiError } from "../api/http";
vi.mock("../api/timers.api", () => ({
  getCurrentTimer: vi.fn(),
  startTimer: vi.fn(),
  timerAction: vi.fn(),
  changeTimerTarget: vi.fn(),
}));
const response = (
  state: "running" | "paused" = "running",
  elapsedMilliseconds = 30_000,
  targetMinutes: number | null = 2,
): TimerResponse => ({
  serverNow: "2026-10-03T10:00:00Z",
  timer: {
    id: "timer-1",
    kind: "todo",
    targetId: 1,
    title: "Schreiben",
    state,
    elapsedMilliseconds,
    targetMinutes,
    targetReachedAt: null,
  },
});
const target = { kind: "todo" as const, targetId: 1, title: "Schreiben" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(performance, "now").mockReturnValue(1000);
  vi.mocked(getCurrentTimer).mockResolvedValue(response());
  vi.mocked(startTimer).mockResolvedValue(response());
  vi.mocked(timerAction).mockResolvedValue(response("paused"));
  vi.mocked(changeTimerTarget).mockResolvedValue(response("paused"));
});
afterEach(() => vi.restoreAllMocks());
describe("synced Timer controller", () => {
  it("counts up from the server's time worked on a monotonic anchor, independent of device date", async () => {
    const c = createTimerController();
    await c.refresh();
    expect(c.elapsed.value).toBe(30_000);
    vi.spyOn(Date, "now").mockReturnValue(0);
    vi.mocked(performance.now).mockReturnValue(31_000);
    c.pulse();
    expect(c.elapsed.value).toBe(60_000);
    c.dispose();
  });
  it("keeps a paused stopwatch fixed through time passing", async () => {
    vi.mocked(getCurrentTimer).mockResolvedValue(response("paused"));
    const c = createTimerController();
    await c.refresh();
    vi.mocked(performance.now).mockReturnValue(999_999);
    c.pulse();
    expect(c.elapsed.value).toBe(30_000);
    c.dispose();
  });
  it("reaches the target at its minute and keeps counting past it", async () => {
    const c = createTimerController();
    await c.refresh();
    expect(c.reached.value).toBe(false);
    vi.mocked(performance.now).mockReturnValue(90_999);
    c.pulse();
    expect(c.reached.value).toBe(false);
    vi.mocked(performance.now).mockReturnValue(91_000);
    c.pulse();
    expect(c.reached.value).toBe(true);
    vi.mocked(performance.now).mockReturnValue(601_000);
    c.pulse();
    expect(c.elapsed.value).toBe(630_000);
    c.dispose();
  });
  it("never reaches a target that does not exist", async () => {
    vi.mocked(getCurrentTimer).mockResolvedValue(
      response("running", 86_400_000, null),
    );
    const c = createTimerController();
    await c.refresh();
    expect(c.reached.value).toBe(false);
    c.dispose();
  });
  it("prevents duplicate start submissions and ignores a stale read after mutation", async () => {
    let resolve!: (r: TimerResponse) => void;
    vi.mocked(getCurrentTimer).mockReturnValue(
      new Promise((r) => (resolve = r)),
    );
    const c = createTimerController();
    const read = c.refresh();
    await c.start(target);
    resolve({ serverNow: response().serverNow, timer: null });
    await read;
    expect(c.timer.value?.id).toBe("timer-1");
    let started!: (r: TimerResponse) => void;
    vi.mocked(startTimer).mockReturnValue(new Promise((r) => (started = r)));
    const first = c.start(target);
    await c.start(target);
    expect(startTimer).toHaveBeenCalledTimes(2);
    started(response());
    await first;
    c.dispose();
  });
  it("requests explicit replacement after conflict and never switches automatically", async () => {
    vi.mocked(startTimer).mockRejectedValueOnce(
      new ApiError("Already active", 409, "ACTIVE_TIMER_EXISTS"),
    );
    const c = createTimerController();
    await c.start(target);
    expect(c.switching.value).toEqual({ target, previousId: "timer-1" });
    expect(startTimer).toHaveBeenCalledTimes(1);
    await c.start(target, c.switching.value!.previousId);
    expect(startTimer).toHaveBeenLastCalledWith(target, "timer-1");
    expect(c.switching.value).toBeNull();
    c.dispose();
  });
  it("never applies an old confirmation to a newer timer", async () => {
    const c = createTimerController();
    await c.refresh();
    expect(await c.action("stop", "old-id")).toBe(false);
    expect(await c.setTarget(3, "old-id")).toBe(false);
    expect(timerAction).not.toHaveBeenCalled();
    expect(changeTimerTarget).not.toHaveBeenCalled();
    c.dispose();
  });
  it("localizes fetch failures while retaining the last known time", async () => {
    const c = createTimerController();
    await c.refresh();
    vi.mocked(getCurrentTimer).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    await c.refresh();
    expect(c.error.value).toContain("Prüfe deine Verbindung");
    expect(c.timer.value?.id).toBe("timer-1");
    expect(c.elapsed.value).toBe(30_000);
    c.dispose();
  });
  it("reports an offline synchronization error without discarding the stopwatch", async () => {
    const c = createTimerController();
    await c.refresh();
    vi.mocked(getCurrentTimer).mockRejectedValue(new Error("Offline"));
    await c.refresh();
    expect(c.error.value).toBe("Offline");
    expect(c.timer.value?.id).toBe("timer-1");
    c.dispose();
  });
  it("does not apply a response after logout/unmount", async () => {
    let resolve!: (r: TimerResponse) => void;
    vi.mocked(getCurrentTimer).mockReturnValue(
      new Promise((r) => (resolve = r)),
    );
    const c = createTimerController();
    const read = c.refresh();
    c.dispose();
    resolve(response());
    await read;
    expect(c.timer.value).toBeNull();
  });
  it("sends server actions and target writes then notifies views", async () => {
    const event = vi.fn();
    window.addEventListener("timer-data-changed", event);
    const c = createTimerController();
    await c.start(target);
    await c.action("pause");
    await c.setTarget(3);
    expect(timerAction).toHaveBeenCalledWith("timer-1", "pause");
    expect(changeTimerTarget).toHaveBeenCalledWith("timer-1", 3);
    expect(event).toHaveBeenCalledTimes(2);
    c.dispose();
    window.removeEventListener("timer-data-changed", event);
  });
});

describe("toggleTimer", () => {
  it("starts a stopwatch for an eligible target", () => {
    const controller = createTimerController();
    const start = vi.spyOn(controller, "start").mockResolvedValue();
    expect(toggleTimer(controller, target, true)).toBe(true);
    expect(start).toHaveBeenCalledWith(target);
    expect(toggleTimer(controller, { ...target, targetId: 2 }, false)).toBe(
      false,
    );
  });
  it("pauses and resumes the target's own stopwatch", () => {
    const controller = createTimerController();
    const action = vi.spyOn(controller, "action").mockResolvedValue(true);
    controller.timer.value = response("running").timer;
    expect(toggleTimer(controller, target, false)).toBe(true);
    expect(action).toHaveBeenLastCalledWith("pause");
    controller.timer.value = response("paused").timer;
    toggleTimer(controller, target, true);
    expect(action).toHaveBeenLastCalledWith("resume");
  });
  it("does nothing without a controller or while one is busy", () => {
    expect(toggleTimer(null, target, true)).toBe(false);
    const controller = createTimerController();
    controller.busy.value = true;
    expect(toggleTimer(controller, target, true)).toBe(false);
  });
});
