import { endOfDay, startOfDay } from '../common/date/local-day';

export type WorkInterval = { startedAt: Date; endedAt: Date };

const MINUTE_MS = 60_000;

export const toMinutes = (milliseconds: number): number =>
  Math.round(milliseconds / MINUTE_MS);

/** The length of one stretch, whatever days it covers. */
export const lengthInMinutes = ({ startedAt, endedAt }: WorkInterval): number =>
  toMinutes(endedAt.getTime() - startedAt.getTime());

/**
 * The time each interval adds to what the earlier ones already cover, so
 * overlapping time counts once, for the stretch that started first. The
 * shares add up to the covered total.
 */
export function coverage<T extends WorkInterval>(
  intervals: T[],
): Map<T, number> {
  const sorted = [...intervals].sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
  );
  const shares = new Map<T, number>();
  let reached = -Infinity;
  for (const interval of sorted) {
    const start = Math.max(interval.startedAt.getTime(), reached);
    const end = interval.endedAt.getTime();
    shares.set(interval, Math.max(0, end - start));
    reached = Math.max(reached, end);
  }
  return shares;
}

/** Total time covered by the intervals; overlapping time counts once. */
export function coveredMilliseconds(intervals: WorkInterval[]): number {
  let total = 0;
  for (const share of coverage(intervals).values()) total += share;
  return total;
}

/**
 * The parts of the intervals that lie on the app's calendar day `date`: a
 * stretch across midnight counts on both days with the time on each.
 */
export function onDay<T extends WorkInterval>(
  intervals: T[],
  date: string,
): T[] {
  const from = startOfDay(date).getTime();
  const to = endOfDay(date).getTime();
  return intervals.flatMap((interval) => {
    const start = Math.max(interval.startedAt.getTime(), from);
    const end = Math.min(interval.endedAt.getTime(), to);
    return end > start
      ? [{ ...interval, startedAt: new Date(start), endedAt: new Date(end) }]
      : [];
  });
}

/** The one definition of the minutes worked on a day. */
export function workedMinutes(intervals: WorkInterval[], date: string): number {
  return toMinutes(coveredMilliseconds(onDay(intervals, date)));
}

/**
 * The minutes worked on a day split by `keyOf`. Each part is rounded on the
 * running sum, so the parts add up to exactly `workedMinutes` of the day.
 */
export function workedMinutesBy<T extends WorkInterval, K>(
  intervals: T[],
  date: string,
  keyOf: (interval: T) => K,
): Map<K, number> {
  const milliseconds = new Map<K, number>();
  for (const [interval, share] of coverage(onDay(intervals, date))) {
    const key = keyOf(interval);
    milliseconds.set(key, (milliseconds.get(key) ?? 0) + share);
  }
  const minutes = new Map<K, number>();
  let sum = 0;
  for (const [key, share] of milliseconds) {
    const before = toMinutes(sum);
    sum += share;
    minutes.set(key, toMinutes(sum) - before);
  }
  return minutes;
}
