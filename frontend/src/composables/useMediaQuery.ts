import { onBeforeUnmount, ref, type Ref } from "vue";

/**
 * Whether a media query matches now, kept current. Without `matchMedia`
 * (tests, old browsers) it never matches, so the narrow layout applies.
 */
export function useMediaQuery(query: string): Readonly<Ref<boolean>> {
  const matches = ref(false);
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return matches;
  const list = window.matchMedia(query);
  matches.value = list.matches;
  const update = (event: MediaQueryListEvent) =>
    (matches.value = event.matches);
  list.addEventListener?.("change", update);
  onBeforeUnmount(() => list.removeEventListener?.("change", update));
  return matches;
}

/**
 * The wide tier: from 56rem, or any window used with a mouse. The tab bar
 * sits at the top there and the stopwatch bar sticks below it; everywhere
 * else (a phone, a touch tablet) both are docked at the bottom.
 */
export const WIDE_QUERY =
  "(min-width: 56rem), (hover: hover) and (pointer: fine)";

/** Below 40rem dialogs and menus are sheets from the bottom. */
export const SHEET_QUERY = "(max-width: 39.99rem)";

/** A sheet dragged down this far by its grabber closes; less springs back. */
export const SHEET_CLOSE_DRAG_PX = 80;
