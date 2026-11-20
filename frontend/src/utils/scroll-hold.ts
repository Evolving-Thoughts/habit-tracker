/**
 * Keeps the page where a navigation put it while the new view loads.
 *
 * A view opens with skeletons and then fills in; the page grows, the bar
 * comes back after the Fokus-Modus, and the browser's scroll anchoring then
 * nudges the page down to keep some element in place, so the title of the
 * view ends up cut off under the bar. While a hold lasts, anchoring is off
 * (`html[data-scroll-hold]` in style.css) and every change of the page's
 * size puts it back at its place. The hold ends as soon as the person
 * scrolls, clicks or presses a scrolling key, once the page has been still
 * for a moment, or after a few seconds at the latest.
 */

const SCROLL_KEYS = new Set([
  "PageUp",
  "PageDown",
  "Home",
  "End",
  "ArrowUp",
  "ArrowDown",
  " ",
]);
const INTENT_EVENTS = ["wheel", "touchstart", "pointerdown"] as const;

let release: (() => void) | null = null;

/** Ends the current hold, if any. */
export function releaseScroll(): void {
  release?.();
}

/**
 * Holds the page at `place()`, read again on every change, so a section
 * further down stays in view while the content above it loads.
 */
export function holdScroll(
  place: () => number,
  { still = 1000, longest = 5000 } = {},
): void {
  releaseScroll();
  if (typeof ResizeObserver === "undefined") return;
  const root = document.documentElement;
  root.dataset.scrollHold = "";

  const settle = (): void => {
    const top = Math.max(
      0,
      Math.min(place(), root.scrollHeight - window.innerHeight),
    );
    if (Math.abs(window.scrollY - top) > 1)
      window.scrollTo({ top, behavior: "instant" });
  };
  let stillTimer = setTimeout(stop, still);
  const longestTimer = setTimeout(stop, longest);
  const observer = new ResizeObserver(() => {
    settle();
    clearTimeout(stillTimer);
    stillTimer = setTimeout(stop, still);
  });
  observer.observe(document.body);
  const onKeydown = (event: KeyboardEvent): void => {
    if (SCROLL_KEYS.has(event.key)) stop();
  };
  for (const name of INTENT_EVENTS)
    window.addEventListener(name, stop, { capture: true, passive: true });
  window.addEventListener("keydown", onKeydown, true);

  function stop(): void {
    observer.disconnect();
    clearTimeout(stillTimer);
    clearTimeout(longestTimer);
    for (const name of INTENT_EVENTS)
      window.removeEventListener(name, stop, { capture: true });
    window.removeEventListener("keydown", onKeydown, true);
    delete root.dataset.scrollHold;
    if (release === stop) release = null;
  }
  release = stop;
}
