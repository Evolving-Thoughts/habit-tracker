/** What ordering a day needs to know about an item. */
export type Orderable = {
  scheduledDate: string;
  /** HH:mm of an appointment or timed habit; null when only the day is set. */
  timeOfDay: string | null;
  /** Where the user sorted it; null if it was never sorted. */
  dayPosition: number | null;
  id: number;
};

/**
 * The order of the days: earlier day first (carried-over items), and within
 * a day one sequence in which appointments are anchors.
 *
 * - What only has its day follows the order the user sorted it into;
 *   whatever was never sorted comes last, oldest first, so new items join
 *   at the end.
 * - Appointments and timed habits stand in that same sequence at their
 *   stored place, so an item can be sorted between two of them. Among each
 *   other they always follow the clock: one stored before an earlier one
 *   moves down to it. One never sorted stands right after the appointment
 *   before it on the clock, or at the head of the day.
 *
 * `tie` decides between items that would otherwise be equal (same place,
 * same id), for callers whose items have no id of their own.
 */
export function sortInDay<T>(
  items: readonly T[],
  orderOf: (item: T) => Orderable,
  tie: (first: T, second: T) => number = () => 0,
): T[] {
  const entries = items.map((item) => ({ item, order: orderOf(item) }));
  const dates = [...new Set(entries.map(({ order }) => order.scheduledDate))];
  dates.sort();
  return dates.flatMap((date) =>
    mergeDay(
      entries.filter(({ order }) => order.scheduledDate === date),
      tie,
    ),
  );
}

type Entry<T> = { item: T; order: Orderable };

function mergeDay<T>(
  entries: Entry<T>[],
  tie: (first: T, second: T) => number,
): T[] {
  const byPlace =
    (empty: number) =>
    (first: Entry<T>, second: Entry<T>): number => {
      const firstPlace = first.order.dayPosition ?? empty;
      const secondPlace = second.order.dayPosition ?? empty;
      if (firstPlace !== secondPlace) return firstPlace - secondPlace;
      return first.order.id - second.order.id || tie(first.item, second.item);
    };
  const open = entries
    .filter(({ order }) => order.timeOfDay === null)
    .sort(byPlace(Number.POSITIVE_INFINITY));
  const anchors = entries
    .filter(({ order }) => order.timeOfDay !== null)
    .sort(
      (first, second) =>
        first.order.timeOfDay!.localeCompare(second.order.timeOfDay!) ||
        byPlace(Number.NEGATIVE_INFINITY)(first, second),
    );

  // An anchor never stands before one that is earlier on the clock.
  let floor = Number.NEGATIVE_INFINITY;
  const placed = anchors.map((entry) => {
    floor = Math.max(floor, entry.order.dayPosition ?? floor);
    return { entry, place: floor };
  });

  const result: T[] = [];
  let next = 0;
  for (const entry of open) {
    const place = entry.order.dayPosition ?? Number.POSITIVE_INFINITY;
    while (next < placed.length && placed[next].place <= place)
      result.push(placed[next++].entry.item);
    result.push(entry.item);
  }
  while (next < placed.length) result.push(placed[next++].entry.item);
  return result;
}
