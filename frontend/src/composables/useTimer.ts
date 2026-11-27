import { inject, ref, computed, type InjectionKey } from "vue";
import { ApiError } from "../api/http";
import {
  getCurrentTimer,
  startTimer,
  timerAction,
  changeTimerTarget,
  type Timer,
  type TimerTarget,
  type TimerResponse,
} from "../api/timers.api";
import {
  primeMilestones,
  RUNNING_STOPWATCH_MS,
  withActionSound,
} from "./action-sounds";
import {
  listenTargetsChanged,
  notifyDataChanged,
  notifyViewsChanged,
} from "./data-sync";
import type { FocusBlockRequest } from "../types/focus-block";
export function createTimerController() {
  const timer = ref<Timer | null>(null);
  const error = ref("");
  const busy = ref(false);
  const switching = ref<{ target: TimerTarget; previousId: string } | null>(
    null,
  );
  const tick = ref(performance.now());
  /**
   * What the server last said, as `${id}:${state}` ("" without a
   * stopwatch, null before its first answer). The state shown runs ahead of
   * it while a press is on its way; whatever follows the server (the
   * Fokus-Sperre) watches this.
   */
  const confirmed = ref<string | null>(null);
  let alive = true;
  let revision = 0;
  let reading = false;
  // The time worked at the moment of the last answer, on the local clock.
  let sampledAt = tick.value;
  let sampledElapsed = 0;
  function apply(
    response: TimerResponse,
    startedAt: number,
    remote = false,
  ): void {
    const previous = timer.value;
    const answer = response.timer
      ? `${response.timer.id}:${response.timer.state}`
      : "";
    // Running now: read the quest hours ahead for the milestone sound at
    // its pause, stop or completion (`action-sounds.ts`).
    if (response.timer?.state === "running" && answer !== confirmed.value)
      primeMilestones(["quest-hours"], RUNNING_STOPWATCH_MS);
    confirmed.value = answer;
    const receivedAt = performance.now();
    sampledAt = receivedAt;
    // The server answered about halfway through the request.
    sampledElapsed =
      (response.timer?.elapsedMilliseconds ?? 0) +
      (response.timer?.state === "running" ? (receivedAt - startedAt) / 2 : 0);
    timer.value = response.timer;
    tick.value = receivedAt;
    error.value = "";
    if (
      remote &&
      previous &&
      (previous.id !== response.timer?.id ||
        previous.targetMinutes !== response.timer?.targetMinutes)
    )
      notifyViewsChanged();
  }
  /** Time worked so far; a running stopwatch counts on from the last answer. */
  const elapsed = computed(() => {
    if (!timer.value) return 0;
    if (timer.value.state !== "running") return sampledElapsed;
    return sampledElapsed + Math.max(0, tick.value - sampledAt);
  });
  /** The planned minutes are worked; the stopwatch runs on regardless. */
  const reached = computed(
    () =>
      !!timer.value &&
      timer.value.targetMinutes !== null &&
      elapsed.value >= timer.value.targetMinutes * 60_000,
  );
  async function refresh(): Promise<void> {
    if (!alive || busy.value || reading) return;
    reading = true;
    const version = revision;
    const started = performance.now();
    try {
      const response = await getCurrentTimer();
      if (alive && version === revision) apply(response, started, true);
    } catch (cause) {
      if (alive && version === revision)
        error.value =
          cause instanceof Error && !(cause instanceof TypeError)
            ? cause.message
            : "Stoppuhr nicht erreichbar. Prüf deine Verbindung.";
    } finally {
      reading = false;
    }
  }
  /**
   * `assumed` is what the press leads to: it shows at once, so a slow
   * connection never makes a press look ignored. The answer replaces it; a
   * failure takes it back.
   */
  async function mutate(
    operation: () => Promise<TimerResponse>,
    changed = false,
    assumed?: Timer,
  ): Promise<boolean> {
    if (!alive || busy.value) return false;
    busy.value = true;
    ++revision;
    const started = performance.now();
    const before = { timer: timer.value, sampledAt, sampledElapsed };
    if (assumed) {
      // The same stopwatch keeps its time; a new one starts counting here.
      tick.value = started;
      sampledElapsed = assumed.id === timer.value?.id ? elapsed.value : 0;
      sampledAt = started;
      timer.value = assumed;
    }
    try {
      const response = await operation();
      if (!alive) return false;
      apply(response, started);
      if (changed) notifyDataChanged();
      return true;
    } catch (cause) {
      if (alive) {
        if (assumed) {
          ({ sampledAt, sampledElapsed } = before);
          timer.value = before.timer;
        }
        error.value =
          cause instanceof Error
            ? cause.message
            : "Die Stoppuhr konnte nicht geändert werden.";
      }
      throw cause;
    } finally {
      busy.value = false;
    }
  }
  async function start(
    target: TimerTarget,
    replaceTimerId?: string,
  ): Promise<void> {
    const current = timer.value;
    // Nothing else in the way: it runs at once. Its time worked before and
    // its Soll come with the answer. Otherwise the server asks first.
    const assumed: Timer | undefined =
      !current || current.id === replaceTimerId
        ? {
            id: "",
            kind: target.kind,
            targetId: target.targetId,
            title: target.title,
            state: "running",
            elapsedMilliseconds: 0,
            targetMinutes: null,
            targetReachedAt: null,
          }
        : undefined;
    try {
      if (
        await withActionSound(
          () =>
            mutate(() => startTimer(target, replaceTimerId), true, assumed),
          // Replacing ends the other stopwatch: its time may reach the goal.
          {
            sound: null,
            kinds: replaceTimerId ? ["quest-hours"] : [],
            ok: (done) => done,
          },
        )
      )
        switching.value = null;
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "ACTIVE_TIMER_EXISTS") {
        await refresh();
        if (timer.value)
          switching.value = { target, previousId: timer.value.id };
      }
    }
  }
  async function action(
    kind: "pause" | "resume" | "stop",
    expectedId?: string,
    focusBlock?: FocusBlockRequest,
  ): Promise<boolean> {
    const current = timer.value;
    if (!current) return false;
    if (expectedId && current.id !== expectedId) {
      error.value = "Die Stoppuhr hat sich auf einem anderen Gerät geändert.";
      return false;
    }
    const run = () =>
      mutate(
        () =>
          kind === "resume" && focusBlock
            ? timerAction(current.id, kind, focusBlock)
            : timerAction(current.id, kind),
        false,
        kind === "stop"
          ? undefined
          : { ...current, state: kind === "pause" ? "paused" : "running" },
      );
    try {
      // Pausing or stopping logs the time: it may reach the weekly goal.
      return await (kind === "resume"
        ? run()
        : withActionSound(run, {
            sound: null,
            kinds: ["quest-hours"],
            ok: (done) => done,
          }));
    } catch {
      return false;
    }
  }
  async function setTarget(
    minutes: number,
    expectedId?: string,
  ): Promise<boolean> {
    const current = timer.value;
    if (!current) return false;
    if (expectedId && current.id !== expectedId) {
      error.value = "Die Stoppuhr hat sich auf einem anderen Gerät geändert.";
      return false;
    }
    try {
      return await mutate(() => changeTimerTarget(current.id, minutes), true);
    } catch {
      return false;
    }
  }
  function pulse(): void {
    tick.value = performance.now();
  }
  /**
   * Keeps the stopwatch in step with the server while the app is open:
   * reads it now, every 3 seconds, when the window gets focus or the page
   * shows again and after a target changed (`notifyDataChanged`), none of
   * these while the page is hidden; a check while a read is on its way
   * adds none. The time shown moves on four times a second. Returns the way
   * to stop.
   */
  function startSync(): () => void {
    const check = (): void => {
      if (document.visibilityState !== "hidden") void refresh();
    };
    void refresh();
    const ticker = setInterval(pulse, 250);
    const poller = setInterval(check, 3000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    const unlisten = listenTargetsChanged(check);
    return () => {
      clearInterval(ticker);
      clearInterval(poller);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      unlisten();
    };
  }
  return {
    timer,
    error,
    busy,
    switching,
    confirmed,
    elapsed,
    reached,
    refresh,
    start,
    action,
    setTarget,
    pulse,
    startSync,
    dispose: () => {
      alive = false;
      ++revision;
    },
  };
}
export type TimerController = ReturnType<typeof createTimerController>;

/**
 * What the play button and the pause and resume buttons do, as one step:
 * pauses or resumes the target's own stopwatch, otherwise starts one for it
 * (which asks first when another stopwatch runs). False when it cannot.
 * A target with `focusBlock` (the Fokus-Modus) sends it on start and resume.
 */
export function toggleTimer(
  controller: TimerController | null,
  target: TimerTarget,
  eligible: boolean,
): boolean {
  if (!controller || controller.busy.value) return false;
  const current = controller.timer.value;
  if (current?.kind === target.kind && current.targetId === target.targetId) {
    if (current.state === "running") void controller.action("pause");
    else if (target.focusBlock)
      void controller.action("resume", undefined, target.focusBlock);
    else void controller.action("resume");
    return true;
  }
  if (!eligible) return false;
  void controller.start(target);
  return true;
}

/** Whether the stopwatch of this target runs or waits paused; null when it has none. */
export function timerStateOf(
  controller: TimerController | null,
  kind: TimerTarget["kind"],
  targetId: number | null,
): "running" | "paused" | null {
  const current = controller?.timer.value;
  if (!current || targetId === null) return null;
  if (current.kind !== kind || current.targetId !== targetId) return null;
  return current.state === "running" ? "running" : "paused";
}

/** The `itemKey` (today-agenda) of what the stopwatch is on; null without one. */
export function timedItemKey(controller: TimerController | null): string | null {
  const current = controller?.timer.value;
  if (!current) return null;
  return `${current.kind === "todo" ? "todo" : "habit"}-${current.targetId}`;
}

export const timerKey: InjectionKey<TimerController> = Symbol("timer");
export function useTimer(): TimerController | null {
  return inject(timerKey, null);
}
