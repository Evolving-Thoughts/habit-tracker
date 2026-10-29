import { onMounted, onUnmounted } from "vue";

/**
 * The one channel that tells open views "server data changed". Writers call
 * notifyDataChanged(); views subscribe with onDataChanged(). Window events
 * are only the transport, so a write that finishes after its view was
 * unmounted still reaches the others (and the timer).
 */
const TARGETS_CHANGED = "timer-target-changed";
const DATA_CHANGED = "timer-data-changed";

/** After any todo/habit/occurrence write: refresh the timer and all views. */
export function notifyDataChanged(): void {
  window.dispatchEvent(new Event(TARGETS_CHANGED));
  window.dispatchEvent(new Event(DATA_CHANGED));
}

/** After a timer-only change (no target data touched): refresh views. */
export function notifyViewsChanged(): void {
  window.dispatchEvent(new Event(DATA_CHANGED));
}

/** Subscribes for the component's lifetime: views get every data change. */
export function onDataChanged(handler: () => void): void {
  onMounted(() => window.addEventListener(DATA_CHANGED, handler));
  onUnmounted(() => window.removeEventListener(DATA_CHANGED, handler));
}

/** Subscribes for the component's lifetime: only target changes (timer provider). */
export function onTargetsChanged(handler: () => void): void {
  onMounted(() => window.addEventListener(TARGETS_CHANGED, handler));
  onUnmounted(() => window.removeEventListener(TARGETS_CHANGED, handler));
}
