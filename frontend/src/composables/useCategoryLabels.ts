import { ref } from "vue";
import { getCategories } from "../api/categories.api";
import type { CategoryResponse } from "../types/category";
import { categoryMark } from "../utils/category-mark";

/** What a row shows of its category: the name and its mark. */
export type CategoryLabel = { name: string; mark: string };

/**
 * Category names and colours for the meta lines of a list that only knows
 * category ids. They only decorate: a failed read leaves rows without a
 * category, never the list unusable.
 */
export function useCategoryLabels() {
  const categories = ref(new Map<number, CategoryResponse>());

  async function load(): Promise<void> {
    try {
      const list = await getCategories();
      categories.value = new Map(list.map((item) => [item.id, item]));
    } catch {
      // Without them the rows simply show no category mark.
    }
  }

  function labelOf(categoryId: number | null): CategoryLabel | null {
    const category =
      categoryId === null ? undefined : categories.value.get(categoryId);
    return category
      ? { name: category.name, mark: categoryMark(category.name, category.color) }
      : null;
  }

  return { load, labelOf };
}
