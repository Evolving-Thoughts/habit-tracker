import { onBeforeUnmount, watch, type WatchSource } from "vue";
import { isNativeAndroid } from "../native/bridge";

/**
 * Everything open on top of a view (every dialog, the "…" menus, the Mehr
 * sheet), in the order it opened. Back on the phone closes the top one
 * through the same function as its close button or Escape (useBackButton).
 *
 * In a browser on a touch screen an overlay that is no <dialog> also gets a
 * CloseWatcher where the browser has one, so Back of an installed web app
 * closes it too; a <dialog> already does that by itself.
 */

type CloseWatcherLike = { onclose: (() => void) | null; destroy(): void };
type Entry = { close: () => void; watcher: CloseWatcherLike | null };

const stack: Entry[] = [];

export type OverlayOptions = {
  /** A <dialog>: the browser's Back closes it without a CloseWatcher. */
  dialog?: boolean;
};

function closeWatcher(close: () => void): CloseWatcherLike | null {
  const Watcher = (
    globalThis as {
      CloseWatcher?: new () => CloseWatcherLike;
    }
  ).CloseWatcher;
  if (typeof Watcher !== "function" || isNativeAndroid()) return null;
  if (!window.matchMedia?.("(pointer: coarse)").matches) return null;
  try {
    const watcher = new Watcher();
    watcher.onclose = close;
    return watcher;
  } catch {
    return null;
  }
}

/** Puts an overlay on top; the returned function takes it off again. */
export function pushOverlay(
  close: () => void,
  options: OverlayOptions = {},
): () => void {
  const entry: Entry = {
    close,
    watcher: options.dialog ? null : closeWatcher(close),
  };
  stack.push(entry);
  return () => {
    const index = stack.indexOf(entry);
    if (index >= 0) stack.splice(index, 1);
    if (entry.watcher) {
      entry.watcher.onclose = null;
      entry.watcher.destroy();
    }
  };
}

export function hasOpenOverlay(): boolean {
  return stack.length > 0;
}

/** Closes the top overlay as its close button would; false when none is open. */
export function closeTopOverlay(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

/**
 * For a component while `open` is true: it is on the stack from then until
 * `open` turns false or the component goes away. Registered during setup,
 * so a dialog inside another one lands above it.
 */
export function useOverlay(
  open: WatchSource<boolean>,
  close: () => void,
  options: OverlayOptions = {},
): void {
  let remove: (() => void) | null = null;
  watch(
    open,
    (isOpen) => {
      if (isOpen && !remove) remove = pushOverlay(close, options);
      else if (!isOpen && remove) {
        remove();
        remove = null;
      }
    },
    { immediate: true, flush: "sync" },
  );
  onBeforeUnmount(() => {
    remove?.();
    remove = null;
  });
}
