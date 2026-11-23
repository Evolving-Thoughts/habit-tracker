import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { Campaign } from '../todos/todo-ancestry';
import {
  normalizeQuery,
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  type TextRange,
} from './search-text';

/** `?q=`: at least two characters once trimmed, at most a hundred. */
export class SearchQueryDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeQuery(value) : value,
  )
  @IsString()
  @MinLength(SEARCH_MIN_LENGTH)
  @MaxLength(SEARCH_MAX_LENGTH)
  readonly q!: string;
}

/** A campaign, quest or daily whose title contains the query. */
export type SearchTitleHit = {
  kind: 'campaign' | 'quest' | 'daily';
  id: number;
  title: string;
  /** The query inside `title`. */
  highlight: TextRange | null;
  /** A completed quest or campaign; a daily is never done. */
  done: boolean;
  scheduledDate: string | null;
  /** The campaign it works towards; a campaign names itself. */
  campaign: Campaign | null;
};

/**
 * A note or answer that contains the query: quest notes (`id` is the
 * todo), the notes of a daily's run (`id` the occurrence, `habitId` its
 * daily, `date` its day), a day's reflection (`date`), a day's best
 * (`date`) or a weekly review (`date` its Monday).
 */
export type SearchTextHit = {
  kind: 'quest-notes' | 'run-notes' | 'reflection' | 'day-best' | 'week-review';
  id: number;
  /** Where the text is, e.g. "Notiz zu Kapitel 2 überarbeiten". */
  label: string;
  /** About 80 characters around the match. */
  snippet: string;
  highlight: TextRange | null;
  date: string | null;
  habitId: number | null;
};

export type SearchResponse = {
  query: string;
  titles: SearchTitleHit[];
  texts: SearchTextHit[];
};
