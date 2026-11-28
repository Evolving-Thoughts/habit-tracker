import { computed, shallowRef } from "vue";
import { getCategories } from "../api/categories.api";
import type { CreatedPlaces } from "../api/new-places.api";
import { getTodoHierarchy } from "../api/todo-hierarchy.api";
import type { CategoryResponse } from "../types/category";
import type { HierarchyTodo } from "../types/todo-hierarchy";
import { categoryMark } from "../utils/category-mark";
import { isCampaignIcon } from "../utils/campaign-style";
import {
  categoryOfChoice,
  parentChoices,
  type ParentChoice,
} from "../utils/parent-choice";
import type { QuestParseOptions } from "../utils/quest-parse";
import { asHierarchyTodo } from "../utils/todo-hierarchy";
import { listenDataChanged } from "./data-sync";

/**
 * The open campaigns and the categories a quick add may name ("Kampagne
 * Buch schreiben", "Kategorie Sport"), for `parseQuest`. One copy for every
 * field on the page (the Plan has one per day), loaded only once a text
 * could name one (a keyword or "für"), never per keystroke. It goes stale
 * when data changes or after a minute and reloads on the next such text;
 * until then the old copy keeps the chips. A failed read waits half a
 * minute before it tries again and leaves the names unrecognised.
 *
 * A campaign or category a quick add just created joins the copy at once
 * (`remember`), so the next quest naming it matches it instead of
 * offering it as new again while the copy reloads.
 *
 * "Neue Quest" takes its names from here too, but never loads them: the
 * lists its two pickers load anyway replace those in the copy (`supply`).
 */

/** A list missing is not known: nothing in it is named, nor offered as new. */
type Loaded = { campaigns?: ParentChoice[]; categories?: CategoryResponse[] };

const loaded = shallowRef<Loaded | null>(null);
let loadedAt = 0;
let failedAt = 0;
let pending: Promise<void> | null = null;
let unlisten: (() => void) | null = null;

const FRESH_MS = 60_000;
const RETRY_MS = 30_000;

/** Words that may introduce a name; anything else needs no list. */
const MAY_NAME = /kampagn|kategor|f(?:ü|ue)r/iu;

function load(): Promise<void> {
  const now = Date.now();
  if (pending) return pending;
  if (loaded.value && now - loadedAt < FRESH_MS) return Promise.resolve();
  if (now - failedAt < RETRY_MS) return Promise.resolve();
  unlisten ??= listenDataChanged(() => {
    loadedAt = 0;
  });
  pending = Promise.all([getTodoHierarchy(), getCategories()])
    .then(([todos, categories]) => {
      loaded.value = {
        campaigns: parentChoices(todos, { campaignsOnly: true }),
        categories,
      };
      loadedAt = Date.now();
      failedAt = 0;
    })
    .catch(() => {
      failedAt = Date.now();
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Forgets the copy (specs; a new account). */
export function forgetQuestParseContext(): void {
  loaded.value = null;
  loadedAt = 0;
  failedAt = 0;
  pending = null;
  unlisten?.();
  unlisten = null;
}

/** Shared by every field: mapped once per load. */
const options = computed<
  Pick<QuestParseOptions, "campaigns" | "categories">
>(() => {
  const lists = loaded.value;
  if (!lists) return {};
  return {
    campaigns: lists.campaigns?.map(({ todo }) => ({
      id: todo.id,
      title: todo.title,
      icon: isCampaignIcon(todo.icon) ? todo.icon : null,
    })),
    categories: lists.categories?.map((category) => ({
      id: category.id,
      name: category.name,
      mark: categoryMark(category.name, category.color),
    })),
  };
});

export function useQuestParseContext() {
  /** Loads the lists when `text` could name a campaign or category. */
  function need(text: string): Promise<void> {
    return MAY_NAME.test(text) ? load() : Promise.resolve();
  }

  /** An open campaign in the copy. */
  function campaign(campaignId: number): ParentChoice | undefined {
    return loaded.value?.campaigns?.find(({ todo }) => todo.id === campaignId);
  }

  /** The category a quest in this campaign starts with, as the editor suggests. */
  function campaignCategory(campaignId: number): number | null {
    const choice = campaign(campaignId);
    return choice ? categoryOfChoice(choice) : null;
  }

  /** Adds what was just created to the copy, until the next load. */
  function remember({ category, campaign }: CreatedPlaces): void {
    const lists = loaded.value;
    if (!lists || (!category && !campaign)) return;
    const todo = campaign && asHierarchyTodo(campaign);
    loaded.value = {
      campaigns:
        todo && lists.campaigns
          ? [...lists.campaigns, { todo, path: [todo.title], campaign: todo }]
          : lists.campaigns,
      categories:
        category && lists.categories
          ? [...lists.categories, category]
          : lists.categories,
    };
  }

  /** Lists loaded elsewhere (a form's pickers) replace those in the copy. */
  function supply(lists: {
    todos?: HierarchyTodo[];
    categories?: CategoryResponse[];
  }): void {
    loaded.value = {
      ...loaded.value,
      ...(lists.todos && {
        campaigns: parentChoices(lists.todos, { campaignsOnly: true }),
      }),
      ...(lists.categories && { categories: lists.categories }),
    };
  }

  return { need, options, campaign, campaignCategory, remember, supply };
}
