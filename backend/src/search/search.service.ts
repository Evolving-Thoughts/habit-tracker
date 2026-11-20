import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Clock } from '../common/clock';
import { weekRange } from '../common/date/local-day';
import { loadTodoAncestry, TodoAncestry } from '../todos/todo-ancestry';
import type { NotesDocument } from '../todos/todo-notes';
import type {
  SearchResponse,
  SearchTextHit,
  SearchTitleHit,
} from './search.dto';
import {
  containsPattern,
  findMatch,
  flatten,
  normalizeQuery,
  notesPlainText,
  shortDate,
  snippetAround,
  weekSpan,
} from './search-text';

/** At most this many titles and this many texts per answer. */
export const SEARCH_LIMIT = 8;
/** A completed quest stays findable by title this many days. */
const RECENT_DONE_DAYS = 30;

const KIND_ORDER = { campaign: 0, quest: 1, daily: 2 } as const;

const QUESTIONS = [
  ['wentWell', 'Was lief gut?'],
  ['wentBadly', 'Was lief nicht gut?'],
  ['changeNext', 'Was ändere ich?'],
] as const;

type TodoRow = {
  id: number;
  title: string;
  parentId: number | null;
  completed: boolean;
  completedAt: Date | null;
  scheduledDate: string | null;
};
type HabitRow = { id: number; title: string };
type QuestNotesRow = {
  id: number;
  title: string;
  notes: NotesDocument;
  at: Date;
};
type RunNotesRow = {
  id: number;
  habitId: number;
  title: string;
  notes: NotesDocument;
  date: string;
};
type ReflectionRow = { id: number; date: string; text: string };
type WeekReviewRow = {
  id: number;
  week: string;
  wentWell: string | null;
  wentBadly: string | null;
  changeNext: string | null;
};

/** Text hits before they are cut to the limit, newest first. */
type Dated = { hit: SearchTextHit; at: string };

/**
 * The search of the command menu: titles of campaigns, quests and dailies,
 * and the plain text of notes, reflections and weekly reviews. Matching
 * ignores case, and accents where the database has `unaccent`; notes are
 * read as the text of their document's nodes (`jsonb_path_query`), so no
 * copy of them has to be kept in step.
 */
@Injectable()
export class SearchService {
  private unaccent: Promise<boolean> | null = null;

  constructor(
    private readonly db: DataSource,
    private readonly clock: Clock,
  ) {}

  async search(userId: string, rawQuery: string): Promise<SearchResponse> {
    const query = normalizeQuery(rawQuery);
    const fold = await this.folding();
    const pattern = containsPattern(query);
    const today = this.clock.today();
    return this.db.transaction('REPEATABLE READ', async (manager) => {
      const ancestry = await loadTodoAncestry(manager, userId, today);
      // One connection: the reads run one after the other.
      const titles = await this.titles(
        manager,
        userId,
        query,
        pattern,
        fold,
        ancestry,
      );
      const texts = await this.texts(
        manager,
        userId,
        query,
        pattern,
        fold,
        today,
      );
      return { query, titles, texts };
    });
  }

  /** `lower(unaccent(x))` where the extension exists, else `lower(x)`. */
  private async folding(): Promise<(sql: string) => string> {
    this.unaccent ??= this.db
      .query<{ present: boolean }[]>(
        `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'unaccent') AS present`,
      )
      .then(([row]) => row.present)
      .catch((error: unknown) => {
        this.unaccent = null;
        throw error;
      });
    return (await this.unaccent)
      ? (sql) => `lower(unaccent(${sql}))`
      : (sql) => `lower(${sql})`;
  }

  private async titles(
    manager: EntityManager,
    userId: string,
    query: string,
    pattern: string,
    fold: (sql: string) => string,
    ancestry: TodoAncestry,
  ): Promise<SearchTitleHit[]> {
    const doneSince = new Date(
      this.clock.now().getTime() - RECENT_DONE_DAYS * 86_400_000,
    );
    const like = (column: string, param: string) =>
      `${fold(column)} LIKE ${fold(param)} ESCAPE '\\'`;
    // Campaigns are top-level todos; which of them are campaigns the
    // ancestry decides below, so a done top-level todo is read either way.
    const todos = await manager.query<TodoRow[]>(
      `SELECT t.id, t.title, t."parentId", t.completed, t."completedAt",
              t."scheduledDate"::text AS "scheduledDate"
       FROM todos t
       WHERE t."userId" = $1 AND t."deletedAt" IS NULL
         AND ${like('t.title', '$2')}
         AND (NOT t.completed OR t."parentId" IS NULL OR t."completedAt" >= $3)
       ORDER BY t.completed, t."updatedAt" DESC
       LIMIT ${SEARCH_LIMIT * 3}`,
      [userId, pattern, doneSince],
    );
    const habits = await manager.query<HabitRow[]>(
      `SELECT h.id, h.title FROM habits h
       WHERE h."userId" = $1 AND h."deletedAt" IS NULL
         AND ${like('h.title', '$2')}
       ORDER BY h."isActive" DESC, h."updatedAt" DESC
       LIMIT ${SEARCH_LIMIT}`,
      [userId, pattern],
    );
    const hits: SearchTitleHit[] = [];
    for (const todo of todos) {
      const campaign = ancestry.campaignOf(todo);
      const isCampaign = todo.parentId === null && campaign?.id === todo.id;
      const recent = !todo.completedAt || todo.completedAt >= doneSince;
      if (!isCampaign && todo.completed && !recent) continue;
      hits.push({
        kind: isCampaign ? 'campaign' : 'quest',
        id: todo.id,
        title: todo.title,
        highlight: findMatch(todo.title, query),
        done: todo.completed,
        scheduledDate: isCampaign ? null : todo.scheduledDate,
        campaign,
      });
    }
    for (const habit of habits)
      hits.push({
        kind: 'daily',
        id: habit.id,
        title: habit.title,
        highlight: findMatch(habit.title, query),
        done: false,
        scheduledDate: null,
        campaign: ancestry.habitCampaign(habit.id),
      });
    // A match at the start of a word first, open before done, then by kind.
    const wordStart = (hit: SearchTitleHit) => {
      const start = hit.highlight?.start ?? -1;
      return start === 0 || /\s/.test(hit.title[start - 1] ?? '') ? 0 : 1;
    };
    return hits
      .map((hit, index) => ({ hit, index }))
      .sort(
        (a, b) =>
          wordStart(a.hit) - wordStart(b.hit) ||
          Number(a.hit.done) - Number(b.hit.done) ||
          KIND_ORDER[a.hit.kind] - KIND_ORDER[b.hit.kind] ||
          a.index - b.index,
      )
      .slice(0, SEARCH_LIMIT)
      .map(({ hit }) => hit);
  }

  private async texts(
    manager: EntityManager,
    userId: string,
    query: string,
    pattern: string,
    fold: (sql: string) => string,
    today: string,
  ): Promise<SearchTextHit[]> {
    const like = (column: string) =>
      `${fold(column)} LIKE ${fold('$2')} ESCAPE '\\'`;
    // The text of a notes document, words split by marks joined ("tight")
    // and blocks apart ("loose"); either may contain the query.
    const notesText = (column: string) => `CROSS JOIN LATERAL (
        SELECT string_agg(v #>> '{}', '') AS tight,
               string_agg(v #>> '{}', ' ') AS loose
        FROM jsonb_path_query(${column}, 'strict $.**.text', '{}', true) AS v
      ) p`;
    const notesMatch = `(${like('p.tight')} OR ${like('p.loose')})`;

    const questNotes = await manager.query<QuestNotesRow[]>(
      `SELECT t.id, t.title, t.notes, t."updatedAt" AS at
         FROM todos t ${notesText('t.notes')}
         WHERE t."userId" = $1 AND t."deletedAt" IS NULL
           AND t.notes IS NOT NULL AND ${notesMatch}
         ORDER BY t."updatedAt" DESC
         LIMIT ${SEARCH_LIMIT}`,
      [userId, pattern],
    );
    const runNotes = await manager.query<RunNotesRow[]>(
      `SELECT o.id, o."habitId", h.title, o.notes,
                COALESCE(o."resolvedDate", o."movedToDate", o."scheduledDate")::text AS date
         FROM habit_occurrences o
         JOIN habits h ON h.id = o."habitId"
         ${notesText('o.notes')}
         WHERE h."userId" = $1 AND h."deletedAt" IS NULL
           AND o.notes IS NOT NULL AND ${notesMatch}
         ORDER BY date DESC, o.id DESC
         LIMIT ${SEARCH_LIMIT}`,
      [userId, pattern],
    );
    const reflections = await manager.query<ReflectionRow[]>(
      `SELECT r.id, r.date::text AS date, r.text FROM reflections r
         WHERE r."userId" = $1 AND ${like('r.text')}
         ORDER BY r.date DESC
         LIMIT ${SEARCH_LIMIT}`,
      [userId, pattern],
    );
    const reviews = await manager.query<WeekReviewRow[]>(
      `SELECT w.id, w.week::text AS week, w."wentWell", w."wentBadly",
                w."changeNext"
         FROM week_reviews w
         WHERE w."userId" = $1 AND (
           ${like(`COALESCE(w."wentWell", '')`)} OR
           ${like(`COALESCE(w."wentBadly", '')`)} OR
           ${like(`COALESCE(w."changeNext", '')`)})
         ORDER BY w.week DESC
         LIMIT ${SEARCH_LIMIT}`,
      [userId, pattern],
    );

    const snippetOf = (text: string) =>
      snippetAround(text, findMatch(text, query));
    const dated: Dated[] = [
      ...questNotes.map((row) => ({
        at: row.at.toISOString().slice(0, 10),
        hit: {
          kind: 'quest-notes' as const,
          id: row.id,
          label: `Notiz zu ${row.title}`,
          ...snippetOf(notesPlainText(row.notes)),
          date: null,
          habitId: null,
        },
      })),
      ...runNotes.map((row) => ({
        at: row.date,
        hit: {
          kind: 'run-notes' as const,
          id: row.id,
          label: `Notiz zu ${row.title} am ${shortDate(row.date, today)}`,
          ...snippetOf(notesPlainText(row.notes)),
          date: row.date,
          habitId: row.habitId,
        },
      })),
      ...reflections.map((row) => ({
        at: row.date,
        hit: {
          kind: 'reflection' as const,
          id: row.id,
          label: `Reflexion vom ${shortDate(row.date, today)}`,
          ...snippetOf(flatten(row.text)),
          date: row.date,
          habitId: null,
        },
      })),
      ...reviews.map((row) => {
        // The answer that holds the query; the first one written otherwise.
        const answers = QUESTIONS.flatMap(([key, question]) => {
          const text = row[key];
          return text ? [{ question, text: flatten(text) }] : [];
        });
        const found =
          answers.find((answer) => findMatch(answer.text, query)) ?? answers[0];
        const { endDate } = weekRange(row.week);
        return {
          at: endDate,
          hit: {
            kind: 'week-review' as const,
            id: row.id,
            label: `Wochenrückblick ${weekSpan(row.week, endDate, today)} · ${found.question}`,
            ...snippetOf(found.text),
            date: row.week,
            habitId: null,
          },
        };
      }),
    ];
    return dated
      .map((entry, index) => ({ ...entry, index }))
      .sort((a, b) => b.at.localeCompare(a.at) || a.index - b.index)
      .slice(0, SEARCH_LIMIT)
      .map(({ hit }) => hit);
  }
}
