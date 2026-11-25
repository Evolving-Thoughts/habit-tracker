import type { CampaignColor } from '../todos/campaign-style';
import type { CategoryEntity } from './category.entity';
import { shownCategoryColors } from './category-colors';

/** What an entry shows of its category: name and chosen colour. */
export type CategoryLabel = {
  categoryName: string | null;
  /** The colour the category shows (`shownCategoryColors`); null without one. */
  categoryColor: CampaignColor | null;
};

const NONE: CategoryLabel = { categoryName: null, categoryColor: null };

/** Resolves a category id from one read of the user's categories. */
export function categoryLabels(
  categories: Pick<CategoryEntity, 'id' | 'name' | 'color'>[],
): (id: number | null) => CategoryLabel {
  const shown = shownCategoryColors(categories);
  const byId = new Map(
    categories.map((category): [number, CategoryLabel] => [
      category.id,
      {
        categoryName: category.name,
        categoryColor: shown.get(category.id) ?? null,
      },
    ]),
  );
  return (id) => (id === null ? NONE : (byId.get(id) ?? NONE));
}
