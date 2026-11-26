import { dayLabel } from "./history";

/**
 * What a day pill in Heute's head ("Auf morgen", "Heute") says when it does
 * not take a card dropped on it, instead of failing in silence. The same
 * words on today and on its other days. See docs/day-order.md › Ablegen.
 */

/** A Google event keeps its day: it is moved in Google Kalender only. */
export function eventStaysLine(title: string): string {
  return `„${title}“ kommt aus Google Kalender und bleibt an seinem Tag. Verschieben lässt er sich nur dort.`;
}

/** A forecast run belongs to its day: it is stored only there. */
export function forecastStaysLine(title: string): string {
  return `„${title}“ ist erst eingeplant und bleibt an seinem Tag. Sortieren lässt es sich dort.`;
}

/** A daily's run moves only within its window (`moveUntil`). */
export function runWindowLine(
  title: string,
  moveUntil: string | null,
  today: string,
): string {
  if (!moveUntil || moveUntil < today)
    return `„${title}“ lässt sich nicht verschieben.`;
  const until = moveUntil === today ? "heute" : dayLabel(moveUntil);
  return `„${title}“ lässt sich nur bis ${until} verschieben.`;
}
