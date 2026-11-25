import type { CampaignColor } from '../todos/campaign-style';
import { withShownColors } from '../categories/category-colors';
import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';

export type PerfectWeekCategory = {
  id: number;
  name: string;
  /** The colour the category shows (`shownCategoryColors`). */
  color: CampaignColor;
  target: number;
  completed: number;
  reached: boolean;
};

type Category = {
  id: number;
  name: string;
  color: CampaignColor | null;
  weeklyTarget: number | null;
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
  categories: Category[],
  completedCategoryIds: (number | null)[],
): PerfectWeek | null {
  const rows = withShownColors(categories).flatMap(
    ({ id, name, color, weeklyTarget }) => {
      if (weeklyTarget === null) return [];
      const completed = completedCategoryIds.filter(
        (item) => item === id,
      ).length;
      return [
        {
          id,
          name,
          color,
          target: weeklyTarget,
          completed,
          reached: completed >= weeklyTarget,
        },
      ];
    },
  );
  if (!rows.length) return null;
  return { perfect: rows.every((row) => row.reached), categories: rows };
}

/**
 * The perfect week from what was resolved in it: completed quests and
 * completed runs count for their category, skipped runs do not.
 */
export function perfectWeekOf(
  categories: Category[],
  todos: { categoryId: number | null }[],
  runs: {
    status: HabitOccurrenceStatus;
    habit: { categoryId: number | null };
  }[],
): PerfectWeek | null {
  return perfectWeek(categories, [
    ...todos.map((todo) => todo.categoryId),
    ...runs
      .filter((run) => run.status === HabitOccurrenceStatus.COMPLETED)
      .map((run) => run.habit.categoryId),
  ]);
}
