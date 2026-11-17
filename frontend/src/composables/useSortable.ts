import Sortable from "sortablejs";
import { onBeforeUnmount, watch, type Ref } from "vue";

/** Where a drag ended: the list it landed in and its place among all children there. */
export type SortableDrop = { item: HTMLElement; list: HTMLElement; index: number };

type SortableOptions = {
  /** Selector of the direct children that can be sorted. */
  item: string;
  /** Selector of the grip inside an item; only it starts a drag. */
  handle: string;
  /**
   * An item went from one place to another. `from` and `to` count among the
   * sortable items of its own list; `drop` also covers a move to another list.
   */
  onMove: (from: number, to: number, drop: SortableDrop) => void;
  /** Lists with the same group trade items with each other. */
  group?: string;
  /** Whether this list takes items from the rest of its group. */
  accepts?: () => boolean;
};

/**
 * Drag sorting for a list that Vue renders. SortableJS moves the DOM node
 * itself; here the node goes straight back and `onMove` reports the change,
 * so the list's data stays the only source of what is shown.
 */
export function useSortable(
  container: Ref<HTMLElement | null>,
  options: SortableOptions,
): void {
  let sortable: Sortable | undefined;

  watch(
    container,
    (element) => {
      sortable?.destroy();
      sortable = undefined;
      if (!element) return;
      sortable = Sortable.create(element, {
        draggable: options.item,
        handle: options.handle,
        group: options.group && {
          name: options.group,
          put: () => options.accepts?.() ?? true,
        },
        animation: 160,
        // The own drag layer behaves the same with mouse, touch and pen.
        forceFallback: true,
        fallbackTolerance: 4,
        onEnd({
          item,
          from,
          to,
          oldIndex,
          newIndex,
          oldDraggableIndex,
          newDraggableIndex,
        }) {
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
