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
): boolean {
  if (!(target instanceof Element)) return false;
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
   * Targets outside the list a card can be dropped on, such as "Morgen" in
   * Heute's head (`[data-day-drop]`). Over one the card's place in the list
   * does not change; on release `onDrop` runs instead of `onMove`.
   */
  dropTarget?: DropTarget;
};

/** A place outside the list that takes a card (see `dropTarget`). */
export type DropTarget = {
  /** Selector of the elements that take a card. */
  selector: string;
  /** Whether this card may land there; a target it may not stays quiet. */
  accepts?: (item: HTMLElement, target: HTMLElement) => boolean;
  onDrop: (item: HTMLElement, target: HTMLElement) => void;
  /** Released over a target that does not take this card: say why. */
  onRefuse?: (item: HTMLElement, target: HTMLElement) => void;
};

/**
 * The day pills in Heute's head ("Morgen", "Heute"): a card dropped on one
 * moves to its `data-date`.
 */
export const DAY_DROP = "[data-day-drop]";

/** On a drop target while a card is over it, and on the page during a drag. */
export const DROP_OVER_CLASS = "drop-target--over";
/** On a drop target while a card it does not take is over it. */
export const DROP_REFUSED_CLASS = "drop-target--refused";
export const DRAGGING_ATTRIBUTE = "data-card-dragging";
/** On the page while the dragged card is over a drop target: it steps back. */
export const DROP_OVER_ATTRIBUTE = "data-card-drop-over";

/** Where the pointer of a mouse, pen or finger is, from any move event. */
function pointOf(event: Event): { x: number; y: number } | null {
  if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  const { clientX, clientY } = event as MouseEvent;
  return typeof clientX === "number" ? { x: clientX, y: clientY } : null;
}

/**
 * Follows the pointer during one drag and marks the drop target under it.
 * The drag layer lets the pointer through (`pointer-events: none`), so the
 * element under it is the page's own.
 */
function trackDropTarget(target: DropTarget, item: HTMLElement) {
  let over: HTMLElement | null = null;
  /** A target under the pointer that does not take this card. */
  let refused: HTMLElement | null = null;
  let point: { x: number; y: number } | null = null;
  const root = document.documentElement;
  const mark = (next: HTMLElement | null) => {
    if (next === over) return;
    over?.classList.remove(DROP_OVER_CLASS);
    over = next;
    over?.classList.add(DROP_OVER_CLASS);
    // The card under the pointer shrinks towards it, so the target shows.
    const card = document.querySelector<HTMLElement>(".sortable-fallback");
    if (card && point && over) {
      // The origin counts from the card's own place, before the drag layer
      // shifted it under the pointer.
      const box = card.getBoundingClientRect();
      const shift = new DOMMatrixReadOnly(getComputedStyle(card).transform);
      card.style.transformOrigin = `${point.x - box.left + shift.e}px ${point.y - box.top + shift.f}px`;
    }
    root.toggleAttribute(DROP_OVER_ATTRIBUTE, !!over);
  };
  const onMove = (event: Event) => {
    point = pointOf(event);
    if (!point) return;
    const hit = document
      .elementFromPoint(point.x, point.y)
      ?.closest<HTMLElement>(target.selector);
    const takes = !!hit && (target.accepts?.(item, hit) ?? true);
    const next = hit && !takes ? hit : null;
    if (next !== refused) {
      refused?.classList.remove(DROP_REFUSED_CLASS);
      next?.classList.add(DROP_REFUSED_CLASS);
      refused = next;
    }
    mark(takes ? hit! : null);
  };
  const events = ["mousemove", "touchmove", "pointermove"] as const;
  for (const name of events)
    document.addEventListener(name, onMove, { passive: true, capture: true });
  root.setAttribute(DRAGGING_ATTRIBUTE, "");
  return {
    /**
     * Where the card was released: on a target that takes it, on one that
     * does not, or neither. Ends the tracking.
     */
    stop(): { landed: HTMLElement | null; refused: HTMLElement | null } {
      for (const name of events)
        document.removeEventListener(name, onMove, { capture: true });
      root.removeAttribute(DRAGGING_ATTRIBUTE);
      const result = { landed: over, refused };
      mark(null);
      refused?.classList.remove(DROP_REFUSED_CLASS);
      refused = null;
      return result;
    },
  };
}

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
  let tracking: ReturnType<typeof trackDropTarget> | null = null;

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
          pressesControl(event.target, item),
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
        // A board of snap columns steps to its next column by itself
        // (`useSnapColumns`); everything else glides under the card.
        scrollFn: (_x, _y, _event, _touch, scroller) =>
          scroller.classList.contains("snap-board") ? undefined : "continue",
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
          if (options.dropTarget)
            tracking = trackDropTarget(options.dropTarget, item);
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
          const { landed, refused } = tracking?.stop() ?? {
            landed: null,
            refused: null,
          };
          tracking = null;
          const putBack = () => {
            // Back exactly where it stood; the data decides where it shows.
            if (
              origin &&
              (!origin.next || origin.next.parentNode === origin.parent)
            )
              origin.parent.insertBefore(item, origin.next);
            else if (oldIndex !== undefined)
              from.insertBefore(item, from.children[oldIndex] ?? null);
          };
          if (landed && options.dropTarget) {
            putBack();
            options.dropTarget.onDrop(item, landed);
            return;
          }
          if (refused && options.dropTarget) {
            putBack();
            options.dropTarget.onRefuse?.(item, refused);
            return;
          }
          if (
            oldIndex === undefined ||
            newIndex === undefined ||
            oldDraggableIndex === undefined ||
            newDraggableIndex === undefined ||
            (from === to && oldIndex === newIndex)
          )
            return;
          putBack();
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

  onBeforeUnmount(() => {
    tracking?.stop();
    sortable?.destroy();
  });
}
