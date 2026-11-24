import type { CategoryResponse } from "../types/category";
import type { TodoResponse } from "../types/todo";
import { colorOfName } from "../utils/category-mark";
import { createCategory } from "./categories.api";
import { createTodo } from "./day-planner.api";

/**
 * A new campaign: a top-level quest in the colour its title picks, which
 * makes it a campaign (PRODUCT.md › Glossar), without day or duration.
 * "Gehört zu" creates one this way, and so does a quest that names one.
 */
export function createCampaign(
  title: string,
  categoryId: number | null = null,
): Promise<TodoResponse> {
  return createTodo({
    title,
    scheduledDate: null,
    timeOfDay: null,
    plannedDurationMinutes: null,
    color: colorOfName(title),
    ...(categoryId === null ? {} : { categoryId }),
  });
}

/** What a quest named that did not exist yet, created before the quest. */
export type NewPlaces = { category?: string; campaign?: string };
export type CreatedPlaces = {
  category?: CategoryResponse;
  campaign?: TodoResponse;
};

/** One of them failed: the words say which; `created` holds what did not. */
export class NewPlaceError extends Error {
  readonly created: CreatedPlaces;
  constructor(message: string, created: CreatedPlaces) {
    super(message);
    this.name = "NewPlaceError";
    this.created = created;
  }
}

const failure = (what: string, name: string, error: unknown) =>
  `${what} „${name}“ konnte nicht angelegt werden, die Quest ist nicht erstellt.${
    error instanceof Error ? ` ${error.message}` : ""
  }`;

/**
 * Creates a named category and campaign that do not exist yet, the
 * category first: a new campaign takes it, or `categoryId`, a category
 * that exists. The category is created as in its picker (the name picks
 * the colour), the campaign as in "Gehört zu" (`createCampaign`).
 */
export async function createNewPlaces(
  wanted: NewPlaces,
  categoryId: number | null = null,
): Promise<CreatedPlaces> {
  const created: CreatedPlaces = {};
  if (wanted.category) {
    try {
      created.category = await createCategory(wanted.category);
    } catch (error) {
      throw new NewPlaceError(
        failure("Die Kategorie", wanted.category, error),
        created,
      );
    }
  }
  if (wanted.campaign) {
    try {
      created.campaign = await createCampaign(
        wanted.campaign,
        created.category?.id ?? categoryId,
      );
    } catch (error) {
      throw new NewPlaceError(
        failure("Die Kampagne", wanted.campaign, error),
        created,
      );
    }
  }
  return created;
}
