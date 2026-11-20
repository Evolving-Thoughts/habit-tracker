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

/** A drag just ended: the click that follows it is no tap on the card. */
export function noteDragEnd(): void {
  lastDragEnd = Date.now();
}

/**
 * Runs `open` for a plain click on the card itself. A click on a control,
 * the click that ends a drag, and a click that ends selecting text are not
 * taps on the card.
 */
export function onCardClick(event: MouseEvent, open: () => void): void {
  if (event.defaultPrevented || event.button !== 0) return;
  if (Date.now() - lastDragEnd < 400) return;
  const card = event.currentTarget;
  const target = event.target;
  if (!(card instanceof Element) || !(target instanceof Element)) return;
  const control = target.closest(CARD_CONTROLS);
  if (control && control !== card && card.contains(control)) return;
  if (window.getSelection?.()?.toString()) return;
  open();
}
