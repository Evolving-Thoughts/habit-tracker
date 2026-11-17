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
 * The order of a day. Appointments and timed habits follow the clock. What
 * only has its day follows the order the user sorted it into; whatever was
 * never sorted comes after that, oldest first, so new items join at the end.
 */
export function compareInDay(first: Orderable, second: Orderable): number {
  if (first.scheduledDate !== second.scheduledDate)
    return first.scheduledDate < second.scheduledDate ? -1 : 1;
  if (first.timeOfDay !== null || second.timeOfDay !== null) {
    if (first.timeOfDay === null) return 1;
    if (second.timeOfDay === null) return -1;
    if (first.timeOfDay !== second.timeOfDay)
      return first.timeOfDay < second.timeOfDay ? -1 : 1;
    return first.id - second.id;
  }
  const firstPlace = first.dayPosition ?? Number.POSITIVE_INFINITY;
  const secondPlace = second.dayPosition ?? Number.POSITIVE_INFINITY;
  return firstPlace === secondPlace
    ? first.id - second.id
    : firstPlace - secondPlace;
}
