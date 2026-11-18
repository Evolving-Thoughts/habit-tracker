import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  shallowReactive,
  type Ref,
} from "vue";
import type { Command } from "../utils/command-filter";
import {
  isInteractiveTarget,
  isTypingTarget,
  matchShortcuts,
  type ShortcutId,
} from "../utils/shortcuts";

/**
 * Keyboard shortcuts at run time: one listener on the window that matches a
 * key against the registry (utils/shortcuts.ts) and hands it to whoever is
 * present. App-wide handlers sit at the bottom; the open view adds its own
 * on top and may decline a key, so the next one below gets it.
 */

/** Where a row shortcut acts: the row under the pointer or with the focus. */
export type ShortcutTarget = {
  row: HTMLElement | null;
  /** The row's `data-focus-key`, e.g. "todo-4". */
  key: string | null;
};

/** Returns false when it does not apply, so the key does what it did before. */
export type ShortcutHandler = (target: ShortcutTarget) => boolean | void;

type Layer = {
  handlers: Partial<Record<ShortcutId, ShortcutHandler>>;
  /** Entries the layer adds to the command menu while it is present. */
  commands?: () => Command[];
  /** App-wide defaults: asked after every view. */
  fallback: boolean;
};

const layers = shallowReactive<Layer[]>([]);

/* The switch in the settings, per device. */
const STORAGE_KEY = "shortcuts:single-keys";
function readSingleKeys(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}
/** Single-key shortcuts (H, X, ?, Space, …) are on. */
export const singleKeys = ref(readSingleKeys());
export function setSingleKeys(on: boolean): void {
  singleKeys.value = on;
  try {
    if (on) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, "off");
  } catch {
    // Without storage the choice lasts until the page is reloaded.
  }
}

/** Read again, e.g. after a test changed the storage. */
export function reloadShortcutSettings(): void {
  singleKeys.value = readSingleKeys();
}

/*
 * Where a keyboard is likely: a precise pointer that can hover, or a key that
 * already reached a shortcut. Hints and the settings show only there.
 */
const KEYBOARD_QUERY = "(hover: hover) and (pointer: fine)";
const finePointer = ref(false);
const keyboardSeen = ref(false);
let watchingPointer = false;
function watchPointer(): void {
  if (watchingPointer || typeof window.matchMedia !== "function") return;
  watchingPointer = true;
  const query = window.matchMedia(KEYBOARD_QUERY);
  finePointer.value = query.matches;
  query.addEventListener?.("change", (event) => {
    finePointer.value = event.matches;
  });
}
const keyboardLikely = computed(() => finePointer.value || keyboardSeen.value);
export function useKeyboardLikely(): Readonly<Ref<boolean>> {
  watchPointer();
  return keyboardLikely;
}

/** Shows Cmd instead of Ctrl. */
export const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** The command menu or the shortcut overview, opened from anywhere. */
export const overlay = ref<"menu" | "overview" | null>(null);

/* The row under the pointer, kept as coordinates: rows move under a still mouse. */
let pointer: { x: number; y: number } | null = null;
let hovered: Element | null = null;
let pointerAt = 0;
let focusAt = 0;
// Counts pointer and focus moves, so the later of the two is known.
let moments = 0;
function onMouseMove(event: MouseEvent): void {
  pointer = { x: event.clientX, y: event.clientY };
  pointerAt = ++moments;
}
function onMouseOver(event: MouseEvent): void {
  hovered = event.target instanceof Element ? event.target : null;
  pointerAt = ++moments;
}
function onMouseOut(event: MouseEvent): void {
  if (event.relatedTarget) return;
  // The pointer left the window.
  pointer = null;
  hovered = null;
}
function onFocusIn(): void {
  focusAt = ++moments;
}

const ROW = "[data-focus-key]";

/**
 * The row a row shortcut means: the one with the focus when the focus moved
 * there after the pointer last moved, otherwise the one under the pointer.
 */
export function targetRow(): HTMLElement | null {
  const active = document.activeElement;
  const focused =
    active && active !== document.body
      ? active.closest<HTMLElement>(ROW)
      : null;
  const atPoint =
    pointer && typeof document.elementFromPoint === "function"
      ? document.elementFromPoint(pointer.x, pointer.y)
      : null;
  // Without coordinates (or elementFromPoint, as in jsdom) the last hovered
  // element stands in.
  const pointed = atPoint ?? (hovered?.isConnected ? hovered : null);
  const under = pointed?.closest<HTMLElement>(ROW) ?? null;
  if (focused && (focusAt > pointerAt || !under)) return focused;
  return under;
}

/** Runs a shortcut as if its key was pressed; true when someone acted. */
export function runShortcut(
  id: ShortcutId,
  target: ShortcutTarget = { row: null, key: null },
): boolean {
  const ordered = [
    ...layers.filter((layer) => !layer.fallback).reverse(),
    ...layers.filter((layer) => layer.fallback).reverse(),
  ];
  for (const layer of ordered) {
    const handler = layer.handlers[id];
    if (handler && handler(target) !== false) return true;
  }
  return false;
}

function onKeydown(event: KeyboardEvent): void {
  const focus =
    event.target instanceof Element ? event.target : document.activeElement;
  const matched = matchShortcuts(event, {
    singleKeys: singleKeys.value,
    typing: isTypingTarget(focus),
    interactive: isInteractiveTarget(focus),
    dialogOpen: !!document.querySelector("dialog[open]"),
  });
  if (!matched.length) return;
  for (const shortcut of matched) {
    let target: ShortcutTarget = { row: null, key: null };
    if (shortcut.id.startsWith("row.")) {
      const row = targetRow();
      if (!row) continue;
      target = { row, key: row.dataset.focusKey ?? null };
    }
    if (runShortcut(shortcut.id, target)) {
      event.preventDefault();
      keyboardSeen.value = true;
      return;
    }
  }
}

function listen(on: boolean): void {
  if (on) {
    window.addEventListener("keydown", onKeydown);
    document.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseover", onMouseOver, { passive: true });
    document.addEventListener("mouseout", onMouseOut, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    return;
  }
  window.removeEventListener("keydown", onKeydown);
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseover", onMouseOver);
  document.removeEventListener("mouseout", onMouseOut);
  document.removeEventListener("focusin", onFocusIn);
  pointer = null;
  hovered = null;
}

/**
 * Handles shortcuts while the component is mounted. A view passes what it
 * can do; `fallback` marks the app-wide defaults below every view.
 */
export function useShortcutHandlers(
  handlers: Layer["handlers"],
  options: { commands?: () => Command[]; fallback?: boolean } = {},
): void {
  const layer: Layer = {
    handlers,
    commands: options.commands,
    fallback: options.fallback ?? false,
  };
  onMounted(() => {
    if (!layers.length) listen(true);
    layers.push(layer);
  });
  onUnmounted(() => {
    const index = layers.indexOf(layer);
    if (index !== -1) layers.splice(index, 1);
    if (!layers.length) listen(false);
  });
}

/** What the present views add to the command menu, top layer first. */
export function layerCommands(): Command[] {
  return [...layers].reverse().flatMap((layer) => layer.commands?.() ?? []);
}

/**
 * Focuses an element as soon as it exists, e.g. the quick add of a view that
 * is still loading. Gives up quietly after `timeout` milliseconds.
 */
export function focusWhenReady(
  find: () => HTMLElement | null | undefined,
  timeout = 5000,
): Promise<boolean> {
  const focus = (): boolean => {
    const element = find();
    if (!element || element.matches(":disabled")) return false;
    element.focus();
    return true;
  };
  if (focus()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (!focus()) return;
      finish(true);
    });
    const timer = setTimeout(() => finish(false), timeout);
    function finish(found: boolean): void {
      observer.disconnect();
      clearTimeout(timer);
      resolve(found);
    }
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });
  });
}
