import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTimerController } from "./useTimer";
import {
  getCurrentTimer,
  startTimer,
  timerAction,
  changeTimerDuration,
  type TimerResponse,
} from "../api/timers.api";
import { ApiError } from "../api/http";
vi.mock("../api/timers.api", () => ({
  getCurrentTimer: vi.fn(),
  startTimer: vi.fn(),
  timerAction: vi.fn(),
  changeTimerDuration: vi.fn(),
}));
const response = (
  state: "running" | "paused" | "finished" = "running",
): TimerResponse => ({
  serverNow: "2026-10-03T10:00:00Z",
  timer: {
    id: "timer-1",
    kind: "todo",
    targetId: 1,
    title: "Schreiben",
    state,
    durationMinutes: 2,
    remainingMilliseconds: 120000,
    endsAt: state === "running" ? "2026-10-03T10:02:00Z" : null,
    finishedAt: null,
  },
});
const target = {
  kind: "todo" as const,
  targetId: 1,
  title: "Schreiben",
  durationMinutes: 2,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(performance, "now").mockReturnValue(1000);
  vi.mocked(getCurrentTimer).mockResolvedValue(response());
  vi.mocked(startTimer).mockResolvedValue(response());
  vi.mocked(timerAction).mockResolvedValue(response("paused"));
  vi.mocked(changeTimerDuration).mockResolvedValue(response("paused"));
});
afterEach(() => vi.restoreAllMocks());
describe("synced Timer controller", () => {
  it("calculates remaining time from server time and a monotonic anchor, independent of device date", async () => {
    const c = createTimerController();
    await c.refresh();
    expect(c.remaining.value).toBe(120000);
    vi.spyOn(Date, "now").mockReturnValue(0);
    vi.mocked(performance.now).mockReturnValue(31000);
    c.pulse();
    expect(c.remaining.value).toBe(90000);
    c.dispose();
  });
  it("keeps a paused timer fixed through time passing", async () => {
    vi.mocked(getCurrentTimer).mockResolvedValue(response("paused"));
    const c = createTimerController();
    await c.refresh();
    vi.mocked(performance.now).mockReturnValue(999999);
    c.pulse();
    expect(c.remaining.value).toBe(120000);
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
    expect(await c.duration(3, "old-id")).toBe(false);
    expect(timerAction).not.toHaveBeenCalled();
    expect(changeTimerDuration).not.toHaveBeenCalled();
    c.dispose();
  });
  it("localizes fetch failures while retaining the last known deadline", async () => {
    const c = createTimerController();
    await c.refresh();
    vi.mocked(getCurrentTimer).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    await c.refresh();
    expect(c.error.value).toContain("Prüfe deine Verbindung");
    expect(c.timer.value?.id).toBe("timer-1");
    c.dispose();
  });
  it("reports an offline synchronization error without discarding the saved deadline", async () => {
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
  it("sends server actions and duration writes then notifies views", async () => {
    const event = vi.fn();
    window.addEventListener("timer-data-changed", event);
    const c = createTimerController();
    await c.start(target);
    await c.action("pause");
    await c.duration(3);
    expect(timerAction).toHaveBeenCalledWith("timer-1", "pause");
    expect(changeTimerDuration).toHaveBeenCalledWith("timer-1", 3);
    expect(event).toHaveBeenCalledTimes(2);
    c.dispose();
    window.removeEventListener("timer-data-changed", event);
  });
});
