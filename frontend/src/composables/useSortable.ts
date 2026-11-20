import Sortable from "sortablejs";
import { onBeforeUnmount, watch, type Ref } from "vue";
import { CARD_CONTROLS, noteDragEnd } from "../utils/card-click";

/** Where a drag ended: the list it landed in and its place among all children there. */
export type SortableDrop = { item: HTMLElement; list: HTMLElement; index: number };

type SortableOptions = {
  /** Selector of the direct children that can be sorted: the whole card drags. */
  item: string;
  /**
   * An item went from one place to another. `from` and `to` count among the
   * sortable items of its own list; `drop` also covers a move to another list.
   */
  onMove: (from: number, to: number, drop: SortableDrop) => void;
  /** Lists with the same group trade items with each other. */
  group?: string;
  /** Whether this list takes items from the rest of its group. */
  accepts?: () => boolean;
  /** False for a list whose items only leave it, never change places in it. */
  sort?: boolean;
};

/** A finger has to rest this long before a card lifts, so a swipe still scrolls. */
export const TOUCH_HOLD_MS = 300;
/** A mouse or pen has to move this far before a press becomes a drag. */
export const DRAG_DISTANCE_PX = 6;

/**
 * Drag sorting for a list that Vue renders. A card drags from anywhere but
 * its own controls: a short click stays a click (it opens the editor), a
 * mouse drags after a few pixels, a finger only after a long press, so
 * scrolling on a phone keeps working. SortableJS moves the DOM node itself;
 * here the node goes straight back and `onMove` reports the change, so the
 * list's data stays the only source of what is shown.
 */
export function useSortable(
  container: Ref<HTMLElement | null>,
  options: SortableOptions,
): void {
  let sortable: Sortable | undefined;
  /** Sortable can end a press that never lifted the card; that stays a click. */
  let lifted = false;

  watch(
    container,
    (element) => {
      sortable?.destroy();
      sortable = undefined;
      if (!element) return;
      sortable = Sortable.create(element, {
        draggable: options.item,
        // Ring, ▶, "…" and links keep their own tap; they never lift the card.
        filter: CARD_CONTROLS,
        preventOnFilter: false,
        group: options.group && {
          name: options.group,
          put: () => options.accepts?.() ?? true,
        },
        sort: options.sort ?? true,
        animation: 160,
        delay: TOUCH_HOLD_MS,
        delayOnTouchOnly: true,
        // A finger that moves before the hold is over scrolls instead.
        touchStartThreshold: 5,
        // The own drag layer behaves the same with mouse, touch and pen.
        forceFallback: true,
        fallbackTolerance: DRAG_DISTANCE_PX,
        onStart() {
          lifted = true;
        },
        onEnd({
          item,
          from,
          to,
          oldIndex,
          newIndex,
          oldDraggableIndex,
          newDraggableIndex,
        }) {
          if (lifted) noteDragEnd();
          lifted = false;
          if (
            oldIndex === undefined ||
            newIndex === undefined ||
            oldDraggableIndex === undefined ||
            newDraggableIndex === undefined ||
            (from === to && oldIndex === newIndex)
          )
            return;
          item.remove();
          from.insertBefore(item, from.children[oldIndex] ?? null);
          options.onMove(oldDraggableIndex, newDraggableIndex, {
            item,
            list: to,
            index: newIndex,
          });
        },
      });
    },
    { immediate: true, flush: "post" },
  );

  onBeforeUnmount(() => sortable?.destroy());
}
