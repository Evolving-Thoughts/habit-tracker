import { whileActive } from "./useActive";

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

/**
 * Subscribes while the component is in the page: views get every data
 * change. A kept-alive view (Heute) stops listening while it is hidden and
 * loads again when it comes back (`useLoader`), instead of fetching in the
 * background for every write elsewhere.
 */
export function onDataChanged(handler: () => void): void {
  whileActive(
    () => window.addEventListener(DATA_CHANGED, handler),
    () => window.removeEventListener(DATA_CHANGED, handler),
  );
}

/** Subscribes outside a component (a shared cache); returns the unsubscribe. */
export function listenDataChanged(handler: () => void): () => void {
  window.addEventListener(DATA_CHANGED, handler);
  return () => window.removeEventListener(DATA_CHANGED, handler);
}

/** Only target changes, for the stopwatch and the Fokus-Sperre; returns the unsubscribe. */
export function listenTargetsChanged(handler: () => void): () => void {
  window.addEventListener(TARGETS_CHANGED, handler);
  return () => window.removeEventListener(TARGETS_CHANGED, handler);
}
