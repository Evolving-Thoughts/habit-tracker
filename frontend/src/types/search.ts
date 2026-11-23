/** Colour and icon are keys from `campaign.ts`. */
type Campaign = {
  id: number;
  title: string;
  color: string | null;
  icon: string | null;
};

/** Where the query sits inside a title or snippet, as string offsets. */
export type TextRange = { start: number; end: number };

/** A campaign, quest or daily whose title contains the query. */
export type SearchTitleHit = {
  kind: "campaign" | "quest" | "daily";
  id: number;
  title: string;
  highlight: TextRange | null;
  /** A completed quest or campaign. */
  done: boolean;
  scheduledDate: string | null;
  /** The campaign it works towards; a campaign names itself. */
  campaign: Campaign | null;
};

/**
 * A note or answer that contains the query. `id` is the todo (quest notes),
 * the run (run notes, with `habitId` and its `date`), the reflection (its
 * `date`), the day's best (its `date`) or the weekly review (`date` is its
 * Monday).
 */
export type SearchTextHit = {
  kind: "quest-notes" | "run-notes" | "reflection" | "day-best" | "week-review";
  id: number;
  label: string;
  snippet: string;
  highlight: TextRange | null;
  date: string | null;
  habitId: number | null;
};

/** GET /search?q= */
export type SearchResponse = {
  query: string;
  titles: SearchTitleHit[];
  texts: SearchTextHit[];
};
