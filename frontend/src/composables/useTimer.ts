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
import { notifyDataChanged, notifyViewsChanged } from "./data-sync";
export function createTimerController() {
  const timer = ref<Timer | null>(null);
  const error = ref("");
  const busy = ref(false);
  const switching = ref<{ target: TimerTarget; previousId: string } | null>(
    null,
  );
  const tick = ref(performance.now());
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
            : "Timer nicht erreichbar. Prüfe deine Verbindung.";
    } finally {
      reading = false;
    }
  }
  async function mutate(
    operation: () => Promise<TimerResponse>,
    changed = false,
  ): Promise<boolean> {
    if (!alive || busy.value) return false;
    busy.value = true;
    ++revision;
    const started = performance.now();
    try {
      const response = await operation();
      if (!alive) return false;
      apply(response, started);
      if (changed) notifyDataChanged();
      return true;
    } catch (cause) {
      if (alive)
        error.value =
          cause instanceof Error
            ? cause.message
            : "Timer konnte nicht geändert werden.";
      throw cause;
    } finally {
      busy.value = false;
    }
  }
  async function start(
    target: TimerTarget,
    replaceTimerId?: string,
  ): Promise<void> {
    try {
      if (await mutate(() => startTimer(target, replaceTimerId), true))
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
  ): Promise<boolean> {
    const current = timer.value;
    if (!current) return false;
    if (expectedId && current.id !== expectedId) {
      error.value =
        "Der aktive Timer hat sich auf einem anderen Gerät geändert.";
      return false;
    }
    try {
      return await mutate(() => timerAction(current.id, kind));
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
      error.value =
        "Der aktive Timer hat sich auf einem anderen Gerät geändert.";
      return false;
    }
    try {
      return await mutate(() => changeTimerTarget(current.id, minutes), true);
    } catch {
      return false;
    }
  }
  return {
    timer,
    error,
    busy,
    switching,
    elapsed,
    reached,
    refresh,
    start,
    action,
    setTarget,
    pulse: () => {
      tick.value = performance.now();
    },
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
 */
export function toggleTimer(
  controller: TimerController | null,
  target: TimerTarget,
  eligible: boolean,
): boolean {
  if (!controller || controller.busy.value) return false;
  const current = controller.timer.value;
  if (current?.kind === target.kind && current.targetId === target.targetId) {
    void controller.action(current.state === "running" ? "pause" : "resume");
    return true;
  }
  if (!eligible) return false;
  void controller.start(target);
  return true;
}

export const timerKey: InjectionKey<TimerController> = Symbol("timer");
export function useTimer(): TimerController | null {
  return inject(timerKey, null);
}
