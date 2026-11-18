import { onUnmounted, shallowRef } from "vue";

/**
 * The offer behind the undo toast: the last tick, kept for five seconds so a
 * slip can be taken back. A new tick replaces the previous offer.
 */
export function useUndo<T>(duration = 5000) {
  const undo = shallowRef<{ target: T; label: string } | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function offer(target: T, label: string): void {
    clearTimeout(timer);
    undo.value = { target, label };
    timer = setTimeout(() => (undo.value = null), duration);
  }

  /** Ends the offer and hands over what to take back, if anything. */
  function take(): T | null {
    const last = undo.value;
    if (!last) return null;
    clearTimeout(timer);
    undo.value = null;
    return last.target;
  }

  onUnmounted(() => clearTimeout(timer));
  return { undo, offer, take };
}
