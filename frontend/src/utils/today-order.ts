import type { DayPlannerItem, DayPlannerResponse } from "../types/day-planner";
import { anchoredOrder, clockBoundIndex } from "./day-order";
import { withDayOrder, type TodayAgenda } from "./today-agenda";

/** How the server names an item of the order (`PUT /day-planner/order`). */
export type OrderRef = { type: "todo" | "habit"; id: number };

export function orderRef(item: DayPlannerItem): OrderRef {
  return item.type === "todo"
    ? { type: "todo", id: item.todoId }
    : { type: "habit", id: item.occurrenceId };
}

/**
 * The rows Heute lets you sort, top to bottom: the focus card first, then
 * the list below it. A Google event holds its row as null: it can be
 * crossed but has no stored place.
 */
export function sortableRows(agenda: TodayAgenda): (DayPlannerItem | null)[] {
  return [
    ...(agenda.focus ? [agenda.focus] : []),
    ...agenda.list.map((entry) => (entry.kind === "event" ? null : entry.item)),
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
 * Drags the row at `from` onto `to` (indices into `sortableRows`). Only
 * stored items crossed on screen count: the focus card stands apart from
 * its stored place and events have none. An appointment stays on the clock
 * among the others. Null when nothing would change.
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
  if (!item) return null;
  const down = from < to;
  const crossed = down
    ? rows.slice(from + 1, to + 1).reverse()
    : rows.slice(to, from);
  const neighbour = crossed.find((entry) => entry !== null);
  if (!neighbour) return null;
  // Moving the focus card, or past it, sorts by what is on screen.
  const base =
    item === agenda.focus || neighbour === agenda.focus
      ? rows.filter((entry): entry is DayPlannerItem => entry !== null)
      : agenda.sequence;
  const sequence = anchoredOrder(base.filter((entry) => entry !== item));
  const index = clockBoundIndex(
    sequence,
    item,
    sequence.indexOf(neighbour) + Number(down),
  );
  sequence.splice(index, 0, item);
  return {
    planner: withDayOrder(planner, sequence),
    order: sequence.map(orderRef),
    message: `„${item.title}“ steht jetzt an Stelle ${sequence.indexOf(item) + 1} von ${sequence.length}.`,
  };
}

/**
 * Where one step up (-1) or down (1) from `item` lands among the sortable
 * rows: events are stepped over, and an appointment never passes another
 * one on the clock. Null when it cannot move that way.
 */
export function stepInDay(
  agenda: TodayAgenda,
  item: DayPlannerItem,
  direction: -1 | 1,
): number | null {
  const rows = sortableRows(agenda);
  const from = rows.indexOf(item);
  if (from === -1) return null;
  for (
    let to = from + direction;
    to >= 0 && to < rows.length;
    to += direction
  ) {
    const row = rows[to];
    if (!row) continue;
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
