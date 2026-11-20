import type { CampaignColor } from '../todos/campaign-style';
import type { CategoryEntity } from './category.entity';

/** What an entry shows of its category: name and chosen colour. */
export type CategoryLabel = {
  categoryName: string | null;
  /** Null while the name picks the colour. */
  categoryColor: CampaignColor | null;
};

const NONE: CategoryLabel = { categoryName: null, categoryColor: null };

/** Resolves a category id from one read of the user's categories. */
export function categoryLabels(
  categories: Pick<CategoryEntity, 'id' | 'name' | 'color'>[],
): (id: number | null) => CategoryLabel {
  const byId = new Map(
    categories.map((category): [number, CategoryLabel] => [
      category.id,
      { categoryName: category.name, categoryColor: category.color },
    ]),
  );
  return (id) => (id === null ? NONE : (byId.get(id) ?? NONE));
}
