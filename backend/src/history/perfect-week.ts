export type PerfectWeekCategory = {
  id: number;
  name: string;
  target: number;
  completed: number;
  reached: boolean;
};

export type PerfectWeek = {
  perfect: boolean;
  categories: PerfectWeekCategory[];
};

/**
 * Compares a week's completions per category with the wanted amount. Only
 * categories with a weekly target take part; null when none has one.
 */
export function perfectWeek(
  categories: { id: number; name: string; weeklyTarget: number | null }[],
  completedCategoryIds: (number | null)[],
): PerfectWeek | null {
  const rows = categories.flatMap(({ id, name, weeklyTarget }) => {
    if (weeklyTarget === null) return [];
    const completed = completedCategoryIds.filter((item) => item === id).length;
    return [
      {
        id,
        name,
        target: weeklyTarget,
        completed,
        reached: completed >= weeklyTarget,
      },
    ];
  });
  if (!rows.length) return null;
  return { perfect: rows.every((row) => row.reached), categories: rows };
}
