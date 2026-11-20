import { onUnmounted, ref, watch, type Ref } from "vue";
import { showTargetNotification } from "../push/target-notification";
import { formatDuration } from "../utils/today-agenda";
import type { TimerController } from "./useTimer";

/** How long the notice stays on screen. */
export const NOTICE_MS = 10_000;
/**
 * A reach noticed later than this (a tab woken from the background) gets
 * the toast but no system notification: the push has said it by then.
 */
const LATE_MS = 30_000;

/**
 * Announces once per stopwatch and Soll that the running stopwatch reached
 * its Soll: a notice in the app and, with permission, a system
 * notification. Only a reach seen happening counts: not a stopwatch that
 * was already past its Soll when it appeared (started again, or a page
 * opened later), and not a Soll lowered below the time worked.
 */
export function useTargetNotice(controller: TimerController): {
  message: Ref<string | null>;
  dismiss: () => void;
} {
  const message = ref<string | null>(null);
  const announced = new Set<string>();
  let hide: ReturnType<typeof setTimeout> | undefined;

  function dismiss(): void {
    clearTimeout(hide);
    message.value = null;
  }

  watch(
    () => {
      const timer = controller.timer.value;
      return timer
        ? {
            id: timer.id,
            title: timer.title,
            target: timer.targetMinutes,
            running: timer.state === "running",
            reached: controller.reached.value,
          }
        : null;
    },
    (seen, before) => {
      if (!seen?.reached || !seen.running || seen.target === null) return;
      if (!before || before.reached) return;
      if (before.id !== seen.id || before.target !== seen.target) return;
      const key = `${seen.id}:${seen.target}`;
      if (announced.has(key)) return;
      announced.add(key);
      // "25 Min." already ends the sentence.
      const soll = formatDuration(seen.target).replace(/\.?$/, ".");
      const text = `${seen.title} · ${soll} Die Stoppuhr läuft weiter.`;
      message.value = `Soll erreicht: ${text}`;
      clearTimeout(hide);
      hide = setTimeout(dismiss, NOTICE_MS);
      const late =
        controller.elapsed.value - seen.target * 60_000 > LATE_MS;
      if (!late)
        void showTargetNotification(seen.id, text);
    },
  );
  onUnmounted(() => clearTimeout(hide));
  return { message, dismiss };
}
