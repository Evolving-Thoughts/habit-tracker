import { readonly, ref, type Ref } from "vue";
import { whileActive } from "./useActive";

export type ScrollDirection = "up" | "down";

/** The page has to move this far one way before the direction counts. */
export const SCROLL_DIRECTION_THRESHOLD_PX = 12;
/** Near the top of the page the direction is always "up". */
export const SCROLL_DIRECTION_TOP_PX = 48;

/**
 * Which way the page last scrolled, for things that step aside while one
 * reads on (the plus button) and come back as soon as one scrolls up.
 *
 * Small jitters do not count, the top of the page always reads as "up", and
 * the jumps of a dialog's scroll lock (the body pinned in place, then the
 * old offset restored) are ignored, so closing a dialog never hides the
 * button its focus returns to. In a kept-alive view (Heute) it rests while
 * the view is hidden and starts afresh when it is shown again.
 */
export function useScrollDirection(): Readonly<Ref<ScrollDirection>> {
  const direction = ref<ScrollDirection>("up");
  /* Where the current movement began; null until the next reading. */
  let anchor: number | null = null;

  function locked(): boolean {
    return document.body.style.position === "fixed";
  }

  function onScroll(): void {
    if (locked()) {
      anchor = null;
      return;
    }
    const y = window.scrollY;
    if (y <= SCROLL_DIRECTION_TOP_PX) {
      direction.value = "up";
      anchor = y;
      return;
    }
    if (anchor === null) {
      anchor = y;
      return;
    }
    const moved = y - anchor;
    if (Math.abs(moved) < SCROLL_DIRECTION_THRESHOLD_PX) return;
    direction.value = moved > 0 ? "down" : "up";
    anchor = y;
  }

  whileActive(
    () => {
      direction.value = "up";
      anchor = window.scrollY;
      window.addEventListener("scroll", onScroll, { passive: true });
    },
    () => window.removeEventListener("scroll", onScroll),
  );

  return readonly(direction);
}
