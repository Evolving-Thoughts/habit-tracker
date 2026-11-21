/**
 * `items` in the order given, with the timed ones (appointments, timed
 * dailies) kept on the clock among each other: the server's rule
 * (`backend/src/day-planner/day-order.ts`). A forecast has no stored place.
 * Everything else may stand between two appointments; an appointment
 * placed before an earlier one moves down to it.
 */
export function anchoredOrder<T extends { timeOfDay: string | null }>(
  items: readonly T[],
  hasPlace: (item: T) => boolean = () => true,
): T[] {
  const placed = items.map((item, index) => ({
    item,
    place: hasPlace(item) ? index : null,
  }));
  const open = placed
    .filter(({ item }) => item.timeOfDay === null)
    .sort((a, b) => (a.place ?? items.length) - (b.place ?? items.length));
  let floor = -1;
  const anchors = placed
    .filter(({ item }) => item.timeOfDay !== null)
    .sort(
      (first, second) =>
        first.item.timeOfDay!.localeCompare(second.item.timeOfDay!) ||
        (first.place ?? -1) - (second.place ?? -1),
    )
    .map(({ item, place }) => {
      floor = Math.max(floor, place ?? floor);
      return { item, place: floor };
    });

  const result: T[] = [];
  let next = 0;
  for (const { item, place } of open) {
    while (next < anchors.length && anchors[next]!.place <= (place ?? items.length))
      result.push(anchors[next++]!.item);
    result.push(item);
  }
  while (next < anchors.length) result.push(anchors[next++]!.item);
  return result;
}
