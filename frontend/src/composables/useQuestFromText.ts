import { createTodo } from "../api/day-planner.api";
import {
  createNewPlaces,
  NewPlaceError,
  type CreatedPlaces,
  type NewPlaces,
} from "../api/new-places.api";
import type { CreateTodoInput, TodoResponse } from "../types/todo";
import { getCurrentDateInTimeZone } from "../utils/date";
import type { QuestParse } from "../utils/quest-parse";
import { notifyDataChanged } from "./data-sync";

/**
 * A quest from typed or dictated text, for the quick add and "Neue Quest"
 * alike: the rules that read a day and a category out of `parseQuest`, and
 * the run that creates what the text named new before the quest itself.
 * Each caller keeps its own fields and builds the create input from them.
 */

/**
 * The day a quest is planned for: a day the text names wins, else the
 * field's own (null: the Questlog); a time without a day is an appointment
 * today.
 */
export function questDay(
  result: QuestParse,
  fieldDay: string | null = null,
): string | null {
  if (result.scheduledDate !== undefined) return result.scheduledDate;
  if (fieldDay !== null) return fieldDay;
  return result.timeOfDay ? getCurrentDateInTimeZone() : null;
}

/**
 * The category the text gives a quest: one it names wins (a new one has no
 * id before it is created: null); else a campaign it names lends its own,
 * as the editor suggests. undefined: the text gives none.
 *
 * A named campaign without a category gives none (null) by default; with
 * `campaignWithoutCategory: "keep"` it gives nothing (undefined), so a form
 * keeps the category its field holds.
 */
export function textCategory(
  result: QuestParse,
  campaignCategory: (campaignId: number) => number | null,
  { campaignWithoutCategory = "none" }: { campaignWithoutCategory?: "none" | "keep" } = {},
): number | null | undefined {
  if (result.newCategory !== undefined) return null;
  if (result.categoryId !== undefined) return result.categoryId;
  if (result.campaignId === undefined) return undefined;
  const lent = campaignCategory(result.campaignId);
  return lent === null && campaignWithoutCategory === "keep" ? undefined : lent;
}

/** What the text named that does not exist yet: created before the quest. */
export function newPlaces(result: QuestParse | null): NewPlaces {
  return { category: result?.newCategory, campaign: result?.newCampaign };
}

export type QuestFromText = {
  /** Named but not existing yet: created first, the category first. */
  places: NewPlaces;
  /** The existing category a new campaign takes when no new one is named. */
  campaignCategoryId: number | null;
  /** The quest's create input, once the places exist. */
  input: (places: CreatedPlaces) => CreateTodoInput;
};

/**
 * Creates the places a quest's text named new, then the quest. What a try
 * created stays known when a later step fails, so the next try takes it
 * instead of creating it twice; it is forgotten once a quest exists.
 * Anything created goes to `learn` and is announced to every view
 * (`notifyDataChanged`). A failed step throws its error.
 */
export function useQuestFromText({
  learn,
}: { learn?: (created: CreatedPlaces) => void } = {}) {
  let createdBefore: CreatedPlaces = {};

  function keep(reused: CreatedPlaces, created: CreatedPlaces): void {
    createdBefore = { ...reused, ...created };
    if (!created.category && !created.campaign) return;
    learn?.(created);
    notifyDataChanged();
  }

  async function create(plan: QuestFromText): Promise<TodoResponse> {
    const { category, campaign } = createdBefore;
    const reused: CreatedPlaces = {
      ...(category && category.name === plan.places.category
        ? { category }
        : {}),
      ...(campaign && campaign.title === plan.places.campaign
        ? { campaign }
        : {}),
    };
    let places: CreatedPlaces;
    try {
      const created = await createNewPlaces(
        {
          category: reused.category ? undefined : plan.places.category,
          campaign: reused.campaign ? undefined : plan.places.campaign,
        },
        reused.category?.id ?? plan.campaignCategoryId,
      );
      keep(reused, created);
      places = { ...reused, ...created };
    } catch (error) {
      if (error instanceof NewPlaceError) keep(reused, error.created);
      throw error;
    }
    const todo = await createTodo(plan.input(places));
    createdBefore = {};
    return todo;
  }

  return { create };
}
