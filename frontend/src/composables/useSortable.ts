import Sortable from "sortablejs";
import { onBeforeUnmount, watch, type Ref } from "vue";

type SortableOptions = {
  /** Selector of the direct children that can be sorted. */
  item: string;
  /** Selector of the grip inside an item; only it starts a drag. */
  handle: string;
  /** An item went from one place to another, counted among the sortable ones. */
  onMove: (from: number, to: number) => void;
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
        animation: 160,
        // The own drag layer behaves the same with mouse, touch and pen.
        forceFallback: true,
        fallbackTolerance: 4,
        onEnd({ item, from, oldIndex, oldDraggableIndex, newDraggableIndex }) {
          if (
            oldIndex === undefined ||
            oldDraggableIndex === undefined ||
            newDraggableIndex === undefined ||
            oldDraggableIndex === newDraggableIndex
          )
            return;
          item.remove();
          from.insertBefore(item, from.children[oldIndex] ?? null);
          options.onMove(oldDraggableIndex, newDraggableIndex);
        },
      });
    },
    { immediate: true, flush: "post" },
  );

  onBeforeUnmount(() => sortable?.destroy());
}
