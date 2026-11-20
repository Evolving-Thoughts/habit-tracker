import type { CategoryResponse } from "../types/category";
import type { HabitResponse } from "../types/habit";
import { categoryMark } from "./category-mark";

/** "Ohne Kategorie" / "Ohne Kampagne" in the filter and the address. */
export const WITHOUT = "ohne";

/**
 * The Dailies' filter as the address holds it (`?kategorie=…&kampagne=…`):
 * null shows all, an id one category or campaign, WITHOUT those without.
 */
export type DailyFilter = {
  category: number | typeof WITHOUT | null;
  campaign: number | typeof WITHOUT | null;
};

function filterValue(value: unknown): number | typeof WITHOUT | null {
  if (value === WITHOUT) return WITHOUT;
  if (typeof value !== "string") return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** The filter from the route's query; anything unknown shows all. */
export function dailyFilterFromQuery(query: Record<string, unknown>): DailyFilter {
  return {
    category: filterValue(query.kategorie),
    campaign: filterValue(query.kampagne),
  };
}

/** The query of a filter; "all" leaves its key out, so the plain address shows all. */
export function dailyFilterQuery(filter: DailyFilter): Record<string, string> {
  const query: Record<string, string> = {};
  if (filter.category !== null) query.kategorie = String(filter.category);
  if (filter.campaign !== null) query.kampagne = String(filter.campaign);
  return query;
}

function matches(
  value: number | null,
  wanted: number | typeof WITHOUT | null,
): boolean {
  if (wanted === null) return true;
  if (wanted === WITHOUT) return value === null;
  return value === wanted;
}

/** Whether a Daily passes the filter; its campaign is the one its chip shows. */
export function passesFilter(habit: HabitResponse, filter: DailyFilter): boolean {
  return (
    matches(habit.categoryId, filter.category) &&
    matches(habit.campaign?.id ?? null, filter.campaign)
  );
}

/** A group of the Dailies: one category, those without, or the paused ones. */
export type DailyGroup = {
  key: string;
  title: string;
  /** The category's mark; null for "Ohne Kategorie" and "Pausiert". */
  mark: string | null;
  habits: HabitResponse[];
};

/**
 * The active Dailies by category, in the order of the categories (as the
 * settings list them), then "Ohne Kategorie" (also for a category that is
 * not known any more), then "Pausiert". Empty groups are left out.
 */
export function dailyGroups(
  habits: HabitResponse[],
  categories: CategoryResponse[],
): DailyGroup[] {
  const known = new Set(categories.map((category) => category.id));
  const active = habits.filter((habit) => habit.isActive);
  const groups: DailyGroup[] = categories.map((category) => ({
    key: `category-${category.id}`,
    title: category.name,
    mark: categoryMark(category.name, category.color),
    habits: active.filter((habit) => habit.categoryId === category.id),
  }));
  groups.push({
    key: "none",
    title: "Ohne Kategorie",
    mark: null,
    habits: active.filter(
      (habit) => habit.categoryId === null || !known.has(habit.categoryId),
    ),
  });
  groups.push({
    key: "paused",
    title: "Pausiert",
    mark: null,
    habits: habits.filter((habit) => !habit.isActive),
  });
  return groups.filter((group) => group.habits.length > 0);
}

/** The campaigns the Dailies belong to, for the filter, by title. */
export function dailyCampaigns(
  habits: HabitResponse[],
): { id: number; title: string }[] {
  const byId = new Map<number, string>();
  for (const habit of habits)
    if (habit.campaign) byId.set(habit.campaign.id, habit.campaign.title);
  return [...byId]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title, "de"));
}
