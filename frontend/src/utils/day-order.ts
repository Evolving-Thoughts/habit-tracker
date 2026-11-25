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

/** Clamp only the card being moved between earlier and later appointments. */
export function clockBoundIndex<T extends { timeOfDay: string | null }>(
  rows: readonly T[], item: T, index: number,
): number {
  const time = item.timeOfDay;
  if (!time) return index;
  let first = 0;
  for (const [at, row] of rows.entries()) {
    if (!row.timeOfDay) continue;
    if (row.timeOfDay > time) return Math.min(at, Math.max(first, index));
    if (row.timeOfDay < time) first = at + 1;
  }
  return Math.max(first, index);
}

/**
 * `rows` (already in the order of the day) with `anchors` joined at their
 * stored places: each stays on the clock among the timed rows (after those
 * that start earlier, before those that start later) and, between them,
 * before the first row stored after it. One never sorted stands right after
 * the timed row before it on the clock, or at the head of the day. The
 * rows keep their order.
 */
export function withAnchors<
  T extends { timeOfDay: string | null; dayPosition?: number | null },
>(rows: readonly T[], anchors: readonly T[]): T[] {
  const result = [...rows];
  const sorted = [...anchors].sort(
    (a, b) =>
      a.timeOfDay!.localeCompare(b.timeOfDay!) ||
      (a.dayPosition ?? -1) - (b.dayPosition ?? -1),
  );
  for (const anchor of sorted) {
    const time = anchor.timeOfDay!;
    let low = 0;
    let high = result.length;
    for (const [index, row] of result.entries()) {
      if (row.timeOfDay === null) continue;
      if (row.timeOfDay <= time) low = index + 1;
      else if (high === result.length) high = index;
    }
    high = Math.max(low, high);
    const place = anchor.dayPosition ?? null;
    let at = low;
    if (place !== null) {
      at = high;
      for (let index = low; index < high; index += 1) {
        if ((result[index]!.dayPosition ?? Number.POSITIVE_INFINITY) > place) {
          at = index;
          break;
        }
      }
    }
    result.splice(at, 0, anchor);
  }
  return result;
}
