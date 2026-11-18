import { onMounted, onUnmounted, ref, watch, type Ref } from "vue";
import { nowInBerlin } from "../utils/today-agenda";

/**
 * Minutes since midnight in Berlin, moved on exactly when something on the
 * page changes with the clock: `nextChange` names that minute (an
 * appointment starts or ends), and one timer waits for it instead of
 * polling. A phone that slept or a tab that was hidden catches up when it
 * becomes visible again.
 */
export function useDayClock(
  nextChange: (now: number) => number | null,
): Ref<number> {
  const now = ref(nowInBerlin());
  let timer: ReturnType<typeof setTimeout> | undefined;

  function sync(): void {
    clearTimeout(timer);
    timer = undefined;
    now.value = nowInBerlin();
    const at = nextChange(now.value);
    if (at === null || at <= now.value) return;
    // Offsets are whole minutes, so the UTC second is the Berlin second.
    const intoMinute = Date.now() % 60_000;
    timer = setTimeout(sync, (at - now.value) * 60_000 - intoMinute + 50);
  }
  function onVisible(): void {
    if (document.visibilityState === "visible") sync();
  }

  // New data can bring a nearer appointment: wait for that one instead.
  watch(() => nextChange(now.value), sync);
  onMounted(() => {
    sync();
    document.addEventListener("visibilitychange", onVisible);
  });
  onUnmounted(() => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
  });
  return now;
}
