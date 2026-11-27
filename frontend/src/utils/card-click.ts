/**
 * The card contract (DESIGN.md › Karten): a tap anywhere on a quest or daily
 * card opens its editor, except on the card's own controls. The title stays
 * the real button for keyboards and screen readers; the rest of the card is
 * a pointer convenience, so no interactive element is nested in another.
 */

/** What a card holds that does its own thing when tapped. */
export const CARD_CONTROLS =
  "button, a, input, select, textarea, label, summary, [role='button'], [role='checkbox'], [role='menuitem'], [contenteditable='true']";

let lastDragEnd = 0;

/** A new press is a new gesture: its click is a tap again. */
function onPress(): void {
  lastDragEnd = 0;
}

/**
 * A drag just ended: the click that follows it is no tap on the card. Only
 * that one click: the next press, however soon, ends the pause.
 */
export function noteDragEnd(): void {
  lastDragEnd = Date.now();
  document.addEventListener("pointerdown", onPress, {
    capture: true,
    once: true,
  });
}

/** Whether a click now is the one that ends a drag or a hold: no tap. */
export function justDragged(): boolean {
  return Date.now() - lastDragEnd < 400;
}

/**
 * The control inside `card` that a click went to, or null for a click on
 * the card itself. Read from the path the click took, not from the page as
 * it is now: a control's own handler runs first and may already have
 * swapped the icon that was hit (play for pause), which then hangs in no
 * button any more.
 */
export function controlHit(event: Event, card: Element): Element | null {
  for (const node of event.composedPath()) {
    if (node === card) return null;
    if (node instanceof Element && node.matches(CARD_CONTROLS)) return node;
  }
  return null;
}

/**
 * Runs `open` for a plain click on the card itself. A click on a control,
 * the click that ends a drag, and a click that ends selecting text are not
 * taps on the card.
 */
export function onCardClick(event: MouseEvent, open: () => void): void {
  if (event.defaultPrevented || event.button !== 0) return;
  if (justDragged()) return;
  const card = event.currentTarget;
  if (!(card instanceof Element) || !(event.target instanceof Element)) return;
  if (controlHit(event, card)) return;
  if (window.getSelection?.()?.toString()) return;
  open();
}
