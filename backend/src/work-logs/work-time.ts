export type WorkInterval = { startedAt: Date; endedAt: Date };

/** Total time covered by the intervals; overlapping time counts once. */
export function coveredMilliseconds(intervals: WorkInterval[]): number {
  const sorted = [...intervals].sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
  );
  let total = 0;
  let reached = -Infinity;
  for (const { startedAt, endedAt } of sorted) {
    const start = Math.max(startedAt.getTime(), reached);
    const end = endedAt.getTime();
    if (end > start) {
      total += end - start;
      reached = end;
    }
  }
  return total;
}
