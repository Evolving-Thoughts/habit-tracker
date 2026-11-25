import type { DayPlannerItem, DayPlannerResponse } from "../types/day-planner";
import { anchoredOrder, clockBoundIndex, type OrderRef } from "./day-order";
import {
  isEventSlot,
  withDayOrder,
  type OrderRow,
  type TodayAgenda,
} from "./today-agenda";

export type { OrderRef };

export function orderRef(row: OrderRow): OrderRef {
  if (isEventSlot(row)) return { type: "event", id: row.event.id };
  return row.type === "todo"
    ? { type: "todo", id: row.todoId }
    : { type: "habit", id: row.occurrenceId };
}

/**
 * The rows Heute lets you sort, top to bottom: the focus card first, then
 * the list below it. A Google event holds its row: it never lifts, but a
 * card dropped next to it keeps that place.
 */
export function sortableRows(agenda: TodayAgenda): OrderRow[] {
  return [
    ...(agenda.focus ? [agenda.focus] : []),
    ...agenda.list.map((entry) =>
      entry.kind === "event" ? entry.slot : entry.item,
    ),
  ];
}

/** A move within the day: shown at once, then written. */
export type DayMove = {
  /** The planner as it reads after the move, for showing it right away. */
  planner: DayPlannerResponse;
  /** The whole order of the day for the server. */
  order: OrderRef[];
  /** What a screen reader hears. */
  message: string;
};

/**
 * Drags the row at `from` onto `to` (indices into `sortableRows`). The
 * rows crossed on screen count, Google events too: a card dropped right
 * after one stays after it. A Google event drags as well, among the cards
 * without a time; like an appointment it stays on the clock among the
 * other appointments and events. The focus card stands apart from its
 * stored place. The Monats-Challenge's run in the evening
 * (`eveningChallenge`) also stands apart from its stored place: a drag of
 * it, or onto it, sorts by what is on screen, and while it is open it keeps
 * showing right below the focus card wherever it was stored. One carried
 * over from an earlier day has no place in today's order and does not move.
 * Null when nothing would change.
 */
export function dropInDay(
  planner: DayPlannerResponse,
  agenda: TodayAgenda,
  from: number,
  to: number,
): DayMove | null {
  if (from === to) return null;
  const rows = sortableRows(agenda);
  const item = rows[from];
  if (!item || (!isEventSlot(item) && item.isOverdue)) return null;
  const down = from < to;
  const crossed = down
    ? rows.slice(from + 1, to + 1).reverse()
    : rows.slice(to, from);
  // Today's items and events have a place; a carried-over run is crossed.
  const placed = (entry: OrderRow | undefined): entry is OrderRow =>
    !!entry && (isEventSlot(entry) || !entry.isOverdue);
  const neighbour = crossed.find(placed);
  if (!neighbour) return null;
  // Moving the focus card or the evening's challenge run, or past one or
  // a Google event, sorts by what is on screen: the focus card heads the
  // screen wherever it is stored, and an event never sorted heads the day.
  const apart = (entry: OrderRow) =>
    entry === agenda.focus ||
    entry === agenda.eveningChallenge ||
    isEventSlot(entry);
  const base =
    apart(item) || apart(neighbour)
      ? rows.filter(placed)
      : agenda.dayOrder;
  const sequence = anchoredOrder(base.filter((entry) => entry !== item));
  const index = clockBoundIndex(
    sequence,
    item,
    sequence.indexOf(neighbour) + Number(down),
  );
  sequence.splice(index, 0, item);
  // A card counts among the own entries, an event among all rows.
  const counted = isEventSlot(item)
    ? sequence
    : sequence.filter((row) => !isEventSlot(row));
  const title = isEventSlot(item) ? item.event.title : item.title;
  return {
    planner: withDayOrder(planner, sequence),
    order: sequence.map(orderRef),
    message: `„${title}“ steht jetzt an Stelle ${counted.indexOf(item) + 1} von ${counted.length}.`,
  };
}

/**
 * Where one step up (-1) or down (1) from `item` lands among the sortable
 * rows: events are stepped over, and an appointment never passes another
 * one on the clock. The evening's challenge run keeps its place below the
 * focus card: it only steps up (onto the focus card's place; not when it
 * was carried over from an earlier day), and the other rows step over it.
 * Null when it cannot move that way.
 */
export function stepInDay(
  agenda: TodayAgenda,
  item: OrderRow,
  direction: -1 | 1,
): number | null {
  if (isEventSlot(item)) return null;
  const rows = sortableRows(agenda);
  const from = rows.indexOf(item);
  if (from === -1) return null;
  const pinned = agenda.eveningChallenge;
  if (item === pinned && (direction === 1 || item.isOverdue)) return null;
  for (
    let to = from + direction;
    to >= 0 && to < rows.length;
    to += direction
  ) {
    const row = rows[to];
    if (!row || isEventSlot(row) || row === pinned) continue;
    const time = row.timeOfDay;
    if (
      item.timeOfDay &&
      time &&
      (direction < 0 ? time < item.timeOfDay : time > item.timeOfDay)
    )
      return null;
    return to;
  }
  return null;
}

/** "Nicht jetzt": `item` goes to the end of the day; appointments keep their place. */
export function postponedToEnd(
  sequence: readonly DayPlannerItem[],
  item: DayPlannerItem,
): OrderRef[] {
  return [...sequence.filter((entry) => entry !== item), item].map(orderRef);
}
