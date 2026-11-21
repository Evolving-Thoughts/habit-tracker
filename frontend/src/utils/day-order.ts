/**
 * `items` in the order given, with the timed ones (appointments, timed
 * dailies) kept on the clock among each other: the server's rule
 * (`backend/src/day-planner/day-order.ts`) for a day whose items all have a
 * place. Everything else may stand between two appointments; an appointment
 * placed before an earlier one moves down to it.
 */
export function anchoredOrder<T extends { timeOfDay: string | null }>(
  items: readonly T[],
): T[] {
  const placed = items.map((item, place) => ({ item, place }));
  const open = placed.filter(({ item }) => item.timeOfDay === null);
  let floor = Number.NEGATIVE_INFINITY;
  const anchors = placed
    .filter(({ item }) => item.timeOfDay !== null)
    .sort(
      (first, second) =>
        first.item.timeOfDay!.localeCompare(second.item.timeOfDay!) ||
        first.place - second.place,
    )
    .map(({ item, place }) => ({ item, place: (floor = Math.max(floor, place)) }));

  const result: T[] = [];
  let next = 0;
  for (const { item, place } of open) {
    while (next < anchors.length && anchors[next]!.place <= place)
      result.push(anchors[next++]!.item);
    result.push(item);
  }
  while (next < anchors.length) result.push(anchors[next++]!.item);
  return result;
}
