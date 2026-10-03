import { inject, ref, computed, type InjectionKey } from "vue";
import { ApiError } from "../api/http";
import {
  getCurrentTimer,
  startTimer,
  timerAction,
  changeTimerDuration,
  type Timer,
  type TimerTarget,
  type TimerResponse,
} from "../api/timers.api";
export function notifyTargetChange(): void {
  window.dispatchEvent(new Event("timer-target-changed"));
  // The write may finish after its originating view was unmounted.
  window.dispatchEvent(new Event("timer-data-changed"));
}
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
  let sampledAt = tick.value;
  let sampledServerTime = Date.now();
  function apply(
    response: TimerResponse,
    startedAt: number,
    remote = false,
  ): void {
    const previous = timer.value;
    const receivedAt = performance.now();
    sampledAt = receivedAt;
    sampledServerTime =
      Date.parse(response.serverNow) + (receivedAt - startedAt) / 2;
    timer.value = response.timer;
    tick.value = receivedAt;
    error.value = "";
    if (
      remote &&
      previous &&
      (previous.id !== response.timer?.id ||
        previous.durationMinutes !== response.timer?.durationMinutes)
    )
      window.dispatchEvent(new Event("timer-data-changed"));
  }
  const remaining = computed(() => {
    if (!timer.value) return 0;
    if (timer.value.state !== "running")
      return timer.value.remainingMilliseconds;
    return Math.max(
      0,
      Date.parse(timer.value.endsAt!) -
        sampledServerTime -
        (tick.value - sampledAt),
    );
  });
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
      if (changed) notifyTargetChange();
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
        if (timer.value && ["running", "paused"].includes(timer.value.state))
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
  async function duration(
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
      return await mutate(() => changeTimerDuration(current.id, minutes), true);
    } catch {
      return false;
    }
  }
  return {
    timer,
    error,
    busy,
    switching,
    remaining,
    refresh,
    start,
    action,
    duration,
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
export const timerKey: InjectionKey<TimerController> = Symbol("timer");
export function useTimer(): TimerController | null {
  return inject(timerKey, null);
}
