import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTimerController,
  timerFreeFor,
  timerStateOf,
  toggleTimer,
} from "./useTimer";
import {
  getCurrentTimer,
  startTimer,
  timerAction,
  changeTimerTarget,
  type TimerResponse,
} from "../api/timers.api";
import { ApiError } from "../api/http";
import { primeMilestones, withActionSound } from "./action-sounds";
vi.mock("../api/timers.api", () => ({
  getCurrentTimer: vi.fn(),
  startTimer: vi.fn(),
  timerAction: vi.fn(),
  changeTimerTarget: vi.fn(),
}));
vi.mock("./action-sounds", () => ({
  RUNNING_STOPWATCH_MS: 43_200_000,
  primeMilestones: vi.fn(),
  withActionSound: vi.fn((action: () => Promise<unknown>) => action()),
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
  it("shows a start, pause and resume at once, before the server answers", async () => {
    const c = createTimerController();
    let answer!: (r: TimerResponse) => void;
    vi.mocked(startTimer).mockReturnValue(new Promise((r) => (answer = r)));
    const starting = c.start(target);
    expect(c.timer.value).toMatchObject({ targetId: 1, state: "running" });
    // The Fokus-Sperre follows the server, not the press.
    expect(c.confirmed.value).toBeNull();
    answer(response("running", 30_000));
    await starting;
    expect(c.confirmed.value).toBe("timer-1:running");
    expect(c.elapsed.value).toBe(30_000);

    vi.mocked(performance.now).mockReturnValue(5000);
    vi.mocked(timerAction).mockReturnValue(new Promise((r) => (answer = r)));
    const pausing = c.action("pause");
    expect(c.timer.value?.state).toBe("paused");
    // The time worked up to the press stays while it waits.
    expect(c.elapsed.value).toBe(34_000);
    vi.mocked(performance.now).mockReturnValue(9000);
    c.pulse();
    expect(c.elapsed.value).toBe(34_000);
    expect(c.confirmed.value).toBe("timer-1:running");
    answer(response("paused", 33_900));
    await pausing;
    expect(c.elapsed.value).toBe(33_900);

    vi.mocked(timerAction).mockReturnValue(new Promise((r) => (answer = r)));
    const resuming = c.action("resume");
    expect(c.timer.value?.state).toBe("running");
    vi.mocked(performance.now).mockReturnValue(10_000);
    c.pulse();
    expect(c.elapsed.value).toBe(34_900);
    answer(response("running", 33_900));
    await resuming;
    c.dispose();
  });
  it("takes a press back when the server refuses it", async () => {
    const c = createTimerController();
    await c.refresh();
    vi.mocked(performance.now).mockReturnValue(3000);
    vi.mocked(timerAction).mockRejectedValue(new Error("Nicht gespeichert."));
    expect(await c.action("pause")).toBe(false);
    expect(c.timer.value?.state).toBe("running");
    expect(c.error.value).toBe("Nicht gespeichert.");
    // It counted on meanwhile, as on the server.
    c.pulse();
    expect(c.elapsed.value).toBe(32_000);

    vi.mocked(startTimer).mockRejectedValue(new Error("Nicht gestartet."));
    const empty = createTimerController();
    await empty.start(target);
    expect(empty.timer.value).toBeNull();
    c.dispose();
    empty.dispose();
  });
  it("does not show a start ahead while another stopwatch is in the way", async () => {
    const c = createTimerController();
    await c.refresh();
    let answer!: (r: TimerResponse) => void;
    vi.mocked(startTimer).mockReturnValue(new Promise((r) => (answer = r)));
    const other = { kind: "todo" as const, targetId: 2, title: "Lesen" };
    const starting = c.start(other);
    expect(c.timer.value?.targetId).toBe(1);
    answer(response());
    await starting;
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
    expect(c.error.value).toBe(
      "Stoppuhr nicht erreichbar. Prüf deine Verbindung.",
    );
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

describe("startSync", () => {
  let visibility: DocumentVisibilityState = "visible";
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("reads once now and once per trigger: poll, focus, page shown, target change", async () => {
    const c = createTimerController();
    const stop = c.startSync();
    await flushPromises();
    expect(c.timer.value).not.toBeNull();
    expect(getCurrentTimer).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3000);
    await flushPromises();
    expect(getCurrentTimer).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event("focus"));
    await flushPromises();
    expect(getCurrentTimer).toHaveBeenCalledTimes(3);
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(getCurrentTimer).toHaveBeenCalledTimes(4);
    window.dispatchEvent(new Event("timer-target-changed"));
    await flushPromises();
    expect(getCurrentTimer).toHaveBeenCalledTimes(5);
    // Not on a change that touched no target.
    window.dispatchEvent(new Event("timer-data-changed"));
    stop();
    vi.advanceTimersByTime(9000);
    window.dispatchEvent(new Event("focus"));
    expect(getCurrentTimer).toHaveBeenCalledTimes(5);
    c.dispose();
  });

  it("sends no second read while one is on its way", async () => {
    let answer!: (r: TimerResponse) => void;
    vi.mocked(getCurrentTimer).mockReturnValue(new Promise((r) => (answer = r)));
    const c = createTimerController();
    const stop = c.startSync();
    // Back in the tab: focus and visibility arrive together, then the poll.
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(3000);
    expect(getCurrentTimer).toHaveBeenCalledTimes(1);
    answer(response());
    await flushPromises();
    expect(c.timer.value).not.toBeNull();
    stop();
    c.dispose();
  });

  it("rests while the page is hidden", async () => {
    const c = createTimerController();
    const stop = c.startSync();
    await flushPromises();
    expect(c.timer.value).not.toBeNull();
    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(30_000);
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("timer-target-changed"));
    expect(getCurrentTimer).toHaveBeenCalledTimes(1);
    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(getCurrentTimer).toHaveBeenCalledTimes(2);
    stop();
    c.dispose();
  });
});

describe("milestone sound of the quest hours", () => {
  const kindsOf = () =>
    vi.mocked(withActionSound).mock.calls.map(([, options]) => options.kinds);

  it("reads them ahead when the stopwatch starts running, here or elsewhere", async () => {
    const c = createTimerController();
    await c.refresh();
    expect(primeMilestones).toHaveBeenCalledWith(["quest-hours"], 43_200_000);
    // The poll that finds it still running reads nothing more.
    await c.refresh();
    expect(primeMilestones).toHaveBeenCalledTimes(1);
    await c.action("pause");
    vi.mocked(timerAction).mockResolvedValue(response("running"));
    await c.action("resume");
    expect(primeMilestones).toHaveBeenCalledTimes(2);
    c.dispose();
  });

  it("listens at pause, stop and a start that replaces another stopwatch, not at resume", async () => {
    vi.mocked(getCurrentTimer).mockResolvedValue(response("paused"));
    const c = createTimerController();
    await c.refresh();
    await c.action("resume");
    await c.action("pause");
    await c.action("stop");
    await c.start(target);
    await c.start(target, "timer-0");
    expect(kindsOf()).toEqual([
      ["quest-hours"],
      ["quest-hours"],
      [],
      ["quest-hours"],
    ]);
    const ok = vi.mocked(withActionSound).mock.calls[0]![1].ok;
    expect(ok?.(false)).toBe(false);
    c.dispose();
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

describe("timerStateOf and timerFreeFor", () => {
  it("names the state of the target's own stopwatch, none for another", () => {
    const controller = createTimerController();
    expect(timerStateOf(controller, target)).toBeNull();
    expect(timerFreeFor(controller, target)).toBe(true);
    controller.timer.value = response("paused").timer;
    expect(timerStateOf(controller, target)).toBe("paused");
    expect(timerFreeFor(controller, target)).toBe(true);
    const other = { ...target, targetId: 2 };
    expect(timerStateOf(controller, other)).toBeNull();
    expect(timerFreeFor(controller, other)).toBe(false);
    expect(timerStateOf(controller, { kind: "occurrence", targetId: 1 })).toBeNull();
    expect(timerStateOf(controller, null)).toBeNull();
    expect(timerStateOf(controller, { kind: "todo", targetId: null })).toBeNull();
  });
  it("is free for anything without a controller", () => {
    expect(timerStateOf(null, target)).toBeNull();
    expect(timerFreeFor(null, target)).toBe(true);
  });
});
