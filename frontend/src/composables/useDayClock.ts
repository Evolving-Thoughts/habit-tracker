import { ref, watch, type Ref } from "vue";
import { nowInBerlin } from "../utils/today-agenda";
import { whileActive } from "./useActive";

/**
 * Minutes since midnight in Berlin, moved on exactly when something on the
 * page changes with the clock: `nextChange` names that minute (an
 * appointment starts or ends), and one timer waits for it instead of
 * polling. A phone that slept or a tab that was hidden catches up when it
 * becomes visible again, and so does a kept-alive view (Heute) that was
 * hidden behind another one: its clock rests meanwhile.
 */
export function useDayClock(
  nextChange: (now: number) => number | null,
): Ref<number> {
  const now = ref(nowInBerlin());
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = false;

  function sync(): void {
    clearTimeout(timer);
    timer = undefined;
    if (!active) return;
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
  whileActive(
    () => {
      active = true;
      sync();
      document.addEventListener("visibilitychange", onVisible);
    },
    () => {
      active = false;
      clearTimeout(timer);
      timer = undefined;
      document.removeEventListener("visibilitychange", onVisible);
    },
  );
  return now;
}
