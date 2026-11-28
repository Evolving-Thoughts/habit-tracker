import { createTodo } from "../api/day-planner.api";
import {
  createNewPlaces,
  NewPlaceError,
  type CreatedPlaces,
  type NewPlaces,
} from "../api/new-places.api";
import type {
  CreateTodoInput,
  InheritedWhy,
  TodoResponse,
} from "../types/todo";
import { getCurrentDateInTimeZone } from "../utils/date";
import { placeBrings } from "../utils/editor-form";
import type { ParentChoice } from "../utils/parent-choice";
import type { QuestParse, QuestParseKind } from "../utils/quest-parse";
import { notifyDataChanged } from "./data-sync";

/**
 * A quest from typed or dictated text, for the quick add and "Neue Quest"
 * alike: the rules that read a day, a place and a category out of
 * `parseQuest` and lay them over a form's own, and the run that creates what
 * the text named new before the quest itself. Each caller builds the create
 * input from what these give.
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
 * none if it has none. undefined: the text gives none.
 */
export function textCategory(
  result: QuestParse,
  campaignCategory: (campaignId: number) => number | null,
): number | null | undefined {
  if (result.newCategory !== undefined) return null;
  if (result.categoryId !== undefined) return result.categoryId;
  if (result.campaignId === undefined) return undefined;
  return campaignCategory(result.campaignId);
}

/** A quest's place and category; undefined: none is given. */
export type QuestPlace = { parentId?: number | null; categoryId?: number | null };

/*
 * Where a quest from text goes and which category it takes over the form's
 * own (`own`): a campaign the text names, or one just created from it,
 * replaces the form's place and its category; the quest then takes the
 * category the text gives (`textCategory`, or one just created), none for a
 * new campaign without one. Without a named campaign the text's category
 * wins over the form's.
 */
export function placeFromText(
  result: QuestParse,
  own: QuestPlace,
  campaignCategory: (campaignId: number) => number | null,
  places: CreatedPlaces = {},
): QuestPlace {
  const named = places.campaign?.id ?? result.campaignId;
  const category =
    places.category?.id ?? textCategory(result, campaignCategory);
  return {
    parentId: named ?? own.parentId,
    categoryId:
      category !== undefined
        ? category
        : named === undefined
          ? own.categoryId
          : undefined,
  };
}

/** The fields of a quest form that its text may fill. */
export type QuestTextFields = {
  /** YYYY-MM-DD or "". */
  date: string;
  /** HH:mm or "". */
  time: string;
  duration: string | number;
  parentId: number | null;
  inheritedWhy: InheritedWhy | null;
  categoryId: number | null;
};

/** The campaigns a text may name, as `useQuestParseContext` knows them. */
type CampaignNames = {
  campaign: (campaignId: number) => ParentChoice | undefined;
  campaignCategory: (campaignId: number) => number | null;
};

/*
 * What a quest form shows while its text is read. A field set by hand
 * (`touched`) keeps the form's own value; the others follow the text: its
 * day, time and duration, else none; its campaign, which brings its Warum,
 * else no place; the category `placeFromText` gives, else the form's own
 * (none, a preset or a chosen place's). Without a parse the own values stand.
 */
export function fieldsFromText(
  own: QuestTextFields,
  result: QuestParse | null,
  touched: Record<QuestParseKind, boolean>,
  names: CampaignNames,
): QuestTextFields {
  if (!result) return own;
  const text = placeFromText(result, {}, names.campaignCategory);
  const campaign =
    text.parentId == null ? undefined : names.campaign(text.parentId);
  return {
    date: touched.date ? own.date : (questDay(result) ?? ""),
    time: touched.time ? own.time : (result.timeOfDay ?? ""),
    duration: touched.duration
      ? own.duration
      : (result.plannedDurationMinutes ?? ""),
    parentId: touched.campaign ? own.parentId : (campaign?.todo.id ?? null),
    inheritedWhy: touched.campaign
      ? own.inheritedWhy
      : placeBrings(campaign ?? null, null).inheritedWhy,
    categoryId:
      touched.category || text.categoryId === undefined
        ? own.categoryId
        : text.categoryId,
  };
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
