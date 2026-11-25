import Sortable from "sortablejs";
import { onBeforeUnmount, watch, type Ref } from "vue";
import { CARD_CONTROLS, noteDragEnd } from "../utils/card-click";

/**
 * A card's title is its edit button for keyboards and screen readers, but
 * for a finger or a mouse it is part of the card: a long press on the words
 * lifts the card like a press anywhere else on it. A plain tap still edits.
 */
const TITLE = "[data-edit-button]";

/** Whether a press starts on a control of the card that keeps its own tap. */
export function pressesControl(
  target: EventTarget | null,
  card: Element,
  anchor?: string,
): boolean {
  if (!(target instanceof Element)) return false;
  if (anchor && target.closest(anchor)) return true;
  const control = target.closest(CARD_CONTROLS);
  return !!control && card.contains(control) && !control.matches(TITLE);
}

/** Set on a card while a finger holds it long enough to move it. */
export const HELD_CLASS = "card-drag--held";

function isTouch(event: Event | undefined): boolean {
  if (!event) return false;
  if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent)
    return true;
  return (event as PointerEvent).pointerType === "touch";
}

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
  /**
   * Selector of items that hold their place: a card can be dropped next to
   * them, but they never lift (a read-only calendar event on Heute). They
   * still count in `onMove`'s places.
   */
  anchor?: string;
};

/** A finger has to rest this long before a card lifts, so a swipe still scrolls. */
export const TOUCH_HOLD_MS = 300;
/** A mouse or pen has to move this far before a press becomes a drag. */
export const DRAG_DISTANCE_PX = 6;
/** How long the device buzzes when a card lifts, where it can. */
export const LIFT_VIBRATION_MS = 10;

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
  /**
   * Where the card stood before it lifted: its parent and the very node
   * after it. Vue keeps a list's entries between text anchors it cannot do
   * without; counting only elements would put the card back outside its
   * anchors, and Vue would then draw a new card beside the lost one.
   */
  let home: { parent: Node; next: Node | null } | null = null;

  watch(
    container,
    (element) => {
      sortable?.destroy();
      sortable = undefined;
      if (!element) return;
      sortable = Sortable.create(element, {
        draggable: options.item,
        // Ring, ▶, "…" and links keep their own tap; they never lift the card.
        // The title is no such control: see TITLE.
        filter: (event, item) =>
          pressesControl(event.target, item, options.anchor),
        preventOnFilter: false,
        group: options.group && {
          name: options.group,
          put: () => options.accepts?.() ?? true,
        },
        sort: options.sort ?? true,
        animation: 160,
        // A card passes another only once the pointer crosses its middle,
        // so cards of different heights (the focus card, a row) do not
        // trade places at the first touch of an edge and jump back and forth.
        swapThreshold: 0.5,
        delay: TOUCH_HOLD_MS,
        delayOnTouchOnly: true,
        // A finger that moves before the hold is over scrolls instead.
        touchStartThreshold: 5,
        // The own drag layer behaves the same with mouse, touch and pen.
        forceFallback: true,
        fallbackTolerance: DRAG_DISTANCE_PX,
        // The finger has held long enough: from now on it moves the card.
        // The card says so at once (it rises, the device buzzes), before
        // the finger moves. A mouse needs no such sign: it drags as soon as
        // it moves.
        onChoose(event) {
          const press = (event as unknown as { originalEvent?: Event })
            .originalEvent;
          if (!isTouch(press)) return;
          event.item.classList.add(HELD_CLASS);
          navigator.vibrate?.(LIFT_VIBRATION_MS);
        },
        onUnchoose({ item }) {
          item.classList.remove(HELD_CLASS);
        },
        onStart({ item }) {
          lifted = true;
          home = item.parentNode
            ? { parent: item.parentNode, next: item.nextSibling }
            : null;
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
          const origin = home;
          home = null;
          if (
            oldIndex === undefined ||
            newIndex === undefined ||
            oldDraggableIndex === undefined ||
            newDraggableIndex === undefined ||
            (from === to && oldIndex === newIndex)
          )
            return;
          // Back exactly where it stood; the data decides where it shows.
          if (origin && (!origin.next || origin.next.parentNode === origin.parent))
            origin.parent.insertBefore(item, origin.next);
          else from.insertBefore(item, from.children[oldIndex] ?? null);
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
