import type { SearchTextHit, SearchTitleHit, TextRange } from "../types/search";
import { shortDate } from "./history";

/** What picking a search result does; the command menu's host carries it out. */
export type SearchAction =
  | { type: "edit-todo"; id: number; notes?: boolean }
  | { type: "timer"; id: number; title: string }
  | { type: "campaign"; id: number }
  | { type: "edit-habit"; id: number; occurrenceId?: number }
  | { type: "day"; date: string }
  | { type: "day-best"; date: string }
  | { type: "week"; date: string };

/** One option of the list: the row itself or one of its side actions. */
export type SearchOption = {
  id: string;
  /** The visible words of a side action; the row itself shows its hit. */
  label: string;
  /** The name a screen reader announces for a side action. */
  ariaLabel?: string;
  action: SearchAction;
};

/** A result as one row; its first option opens it, the rest are side actions. */
export type SearchRow =
  | {
      group: "titles";
      key: string;
      hit: SearchTitleHit;
      meta: string;
      options: SearchOption[];
    }
  | {
      group: "texts";
      key: string;
      hit: SearchTextHit;
      options: SearchOption[];
    };

const KIND_WORDS: Record<SearchTitleHit["kind"], string> = {
  campaign: "Kampagne",
  quest: "Quest",
  daily: "Daily",
};

/** "Quest · erledigt · 18. Nov.": what it is, then its state and day. */
function titleMeta(hit: SearchTitleHit): string {
  const parts: string[] = [KIND_WORDS[hit.kind]];
  if (hit.done)
    parts.push(hit.kind === "campaign" ? "abgeschlossen" : "erledigt");
  if (hit.scheduledDate) parts.push(shortDate(hit.scheduledDate));
  return parts.join(" · ");
}

function titleOptions(hit: SearchTitleHit, key: string): SearchOption[] {
  if (hit.kind === "campaign")
    return [
      { id: key, label: hit.title, action: { type: "campaign", id: hit.id } },
    ];
  if (hit.kind === "daily")
    return [
      { id: key, label: hit.title, action: { type: "edit-habit", id: hit.id } },
    ];
  const options: SearchOption[] = [
    { id: key, label: hit.title, action: { type: "edit-todo", id: hit.id } },
  ];
  if (!hit.done)
    options.push({
      id: `${key}-timer`,
      label: "Stoppuhr starten",
      ariaLabel: `Stoppuhr starten für „${hit.title}“`,
      action: { type: "timer", id: hit.id, title: hit.title },
    });
  if (hit.campaign)
    options.push({
      id: `${key}-campaign`,
      label: "Zur Kampagne",
      ariaLabel: `Zur Kampagne „${hit.campaign.title}“`,
      action: { type: "campaign", id: hit.campaign.id },
    });
  return options;
}

/** Campaigns, quests and dailies found by title, as rows of the menu. */
export function titleRows(hits: readonly SearchTitleHit[]): SearchRow[] {
  return hits.map((hit) => {
    const key = `search-${hit.kind}-${hit.id}`;
    return {
      group: "titles",
      key,
      hit,
      meta: titleMeta(hit),
      options: titleOptions(hit, key),
    };
  });
}

/**
 * Where a text hit leads: the notes in their editor, the day, the day's
 * best in its timeline, the week.
 */
function textAction(hit: SearchTextHit): SearchAction {
  switch (hit.kind) {
    case "quest-notes":
      return { type: "edit-todo", id: hit.id, notes: true };
    case "run-notes":
      return { type: "edit-habit", id: hit.habitId!, occurrenceId: hit.id };
    case "reflection":
      return { type: "day", date: hit.date! };
    case "day-best":
      return { type: "day-best", date: hit.date! };
    case "week-review":
      return { type: "week", date: hit.date! };
  }
}

/** Notes, reflections, day bests and weekly reviews found by their text. */
export function textRows(hits: readonly SearchTextHit[]): SearchRow[] {
  return hits.map((hit) => {
    const key = `search-${hit.kind}-${hit.id}`;
    return {
      group: "texts",
      key,
      hit,
      options: [{ id: key, label: hit.label, action: textAction(hit) }],
    };
  });
}

/**
 * A text cut at the match, for a `<mark>` around the middle part. Rendered
 * as text, never as HTML; a missing or broken range marks nothing.
 */
export function highlightParts(
  text: string,
  range: TextRange | null,
): { before: string; match: string; after: string } {
  if (
    !range ||
    range.start < 0 ||
    range.end > text.length ||
    range.start >= range.end
  )
    return { before: text, match: "", after: "" };
  return {
    before: text.slice(0, range.start),
    match: text.slice(range.start, range.end),
    after: text.slice(range.end),
  };
}
