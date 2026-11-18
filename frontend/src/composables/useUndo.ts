import { onUnmounted, shallowRef } from "vue";

/**
 * The offer behind the undo toast: the last tick, kept for five seconds so a
 * slip can be taken back. A new tick replaces the previous offer.
 *
 * An offer may carry `commit`: a step held back until the offer ends without
 * being taken (time is up, a new offer replaces it, the view goes, `flush`).
 * That is how a delete waits for its toast: nothing is gone until then.
 */
export function useUndo<T>(duration = 5000) {
  const undo = shallowRef<{ target: T; label: string } | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: (() => void) | undefined;

  /** Ends the current offer; its held step runs now. */
  function flush(): void {
    clearTimeout(timer);
    undo.value = null;
    const commit = pending;
    pending = undefined;
    commit?.();
  }

  function offer(target: T, label: string, commit?: () => void): void {
    flush();
    undo.value = { target, label };
    pending = commit;
    timer = setTimeout(flush, duration);
  }

  /** Ends the offer and hands over what to take back, if anything. */
  function take(): T | null {
    const last = undo.value;
    if (!last) return null;
    clearTimeout(timer);
    undo.value = null;
    pending = undefined;
    return last.target;
  }

  onUnmounted(flush);
  return { undo, offer, take, flush };
}
