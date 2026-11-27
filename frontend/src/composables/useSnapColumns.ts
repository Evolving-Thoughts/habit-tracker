import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";
import { columnAt } from "../utils/week-plan";
import { useMediaQuery } from "./useMediaQuery";

/**
 * A board of columns that shows one column per screen on a phone (the
 * Plan, the campaign board): each column as wide as the board, snapping
 * into place (`.snap-board` in style.css), with a strip of chips above
 * (`ColumnChips`). This keeps which column is in view and brings one on
 * a tap. A card carried to the edge of the screen brings the next column:
 * one step, then again only after the card left the edge or stayed there
 * for `EDGE_DWELL_MS`, so the board never runs past the column meant.
 */
/** How close to the edge of the screen a carried card turns the board. */
export const EDGE_PX = 40;
/** How long a card held at the edge waits before the board turns again. */
export const EDGE_DWELL_MS = 700;

export function useSnapColumns(
  board: Ref<HTMLElement | null>,
  options: {
    /** Whether the board shows one column per screen now. */
    active: Readonly<Ref<boolean>>;
    /** How many columns it holds. */
    count: () => number;
  },
) {
  /** The column in view. */
  const current = ref(0);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  function columnStep(scroller: HTMLElement): number {
    const gap = parseFloat(getComputedStyle(scroller).columnGap) || 0;
    return scroller.clientWidth + gap;
  }

  let frame = 0;
  /** The board's scroll handler: marks the column nearest in view. */
  function onScroll(): void {
    if (!options.active.value || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const scroller = board.value;
      if (scroller)
        current.value = columnAt(
          scroller.scrollLeft,
          columnStep(scroller),
          options.count(),
        );
    });
  }
  onBeforeUnmount(() => cancelAnimationFrame(frame));

  /** Brings column `index` into view; smoothly unless motion is reduced. */
  function showColumn(index: number, smooth = true): void {
    const scroller = board.value;
    const column = scroller?.children[index];
    if (!scroller || !(column instanceof HTMLElement)) return;
    current.value = index;
    if (typeof scroller.scrollTo !== "function") {
      scroller.scrollLeft = column.offsetLeft;
      return;
    }
    scroller.scrollTo({
      left: column.offsetLeft,
      behavior: smooth && !reducedMotion.value ? "smooth" : "auto",
    });
  }

  /* A card carried to the edge of the screen. */
  let stepped = -Infinity;
  /** The edge the card is at since the last step: 1 right, -1 left, 0 none. */
  let edge = 0;
  function onCarry(event: PointerEvent | TouchEvent): void {
    const scroller = board.value;
    if (!options.active.value || !scroller) return;
    const x =
      "touches" in event ? event.touches[0]?.clientX : event.clientX;
    if (x === undefined) return;
    const direction =
      x >= window.innerWidth - EDGE_PX ? 1 : x <= EDGE_PX ? -1 : 0;
    if (!direction) {
      edge = 0;
      return;
    }
    // Only a carried card turns the board: Sortable's floating copy is in it.
    if (!scroller.querySelector(".sortable-fallback")) return;
    const now = performance.now();
    if (edge === direction && now - stepped < EDGE_DWELL_MS) return;
    edge = direction;
    stepped = now;
    const next = current.value + direction;
    if (next >= 0 && next < options.count()) showColumn(next);
  }
  onMounted(() => {
    document.addEventListener("pointermove", onCarry, { passive: true });
    document.addEventListener("touchmove", onCarry, { passive: true });
  });
  onBeforeUnmount(() => {
    document.removeEventListener("pointermove", onCarry);
    document.removeEventListener("touchmove", onCarry);
  });

  return { current, onScroll, showColumn };
}
