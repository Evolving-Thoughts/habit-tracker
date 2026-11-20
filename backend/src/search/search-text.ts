import type { NotesNode } from '../todos/todo-notes';

/**
 * Plain-text helpers of the search: what a notes document reads as, where a
 * query sits in a text regardless of case and accents, and the short snippet
 * around it. The database finds the rows; these only place the match.
 */

/** Where the match sits inside a title or snippet, as string offsets. */
export type TextRange = { start: number; end: number };

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;
/** About this many characters of text around a match. */
export const SNIPPET_LENGTH = 80;

/** One character as the search compares it: lower case, without accents. */
function foldChar(char: string): string {
  return char
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ß/g, 'ss')
    .toLowerCase();
}

/** The query as it is compared: trimmed, inner whitespace collapsed. */
export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ');
}

/** A LIKE pattern that finds the query anywhere, wildcards escaped. */
export function containsPattern(query: string): string {
  return `%${normalizeQuery(query).replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/**
 * The first place the query occurs in `text`, ignoring case and accents
 * ("uberarbeiten" finds "Überarbeiten"), as offsets into `text`.
 */
export function findMatch(text: string, query: string): TextRange | null {
  const needle = [...normalizeQuery(query)].map(foldChar).join('');
  if (!needle) return null;
  // The folded text, and for each of its characters the original offset.
  let folded = '';
  const origin: number[] = [];
  let offset = 0;
  for (const char of text) {
    const fold = foldChar(char);
    folded += fold;
    for (let i = 0; i < fold.length; i++) origin.push(offset);
    offset += char.length;
  }
  origin.push(offset);
  const at = folded.indexOf(needle);
  if (at < 0) return null;
  const start = origin[at];
  // The match ends after the original character its last folded one came from.
  const last = origin[at + needle.length - 1];
  const end = last + String.fromCodePoint(text.codePointAt(last)!).length;
  return { start, end };
}

/** Whitespace of a stored text collapsed to single spaces. */
export function flatten(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const BLOCKS = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  'horizontalRule',
]);

/**
 * What a notes document reads as: the text of its nodes in order, blocks
 * and line breaks apart, marks joined to the words they mark.
 */
export function notesPlainText(
  document: { content?: NotesNode[] } | null,
): string {
  const parts: string[] = [];
  const walk = (nodes: NotesNode[] | undefined): void => {
    for (const node of nodes ?? []) {
      if (node.type === 'text') parts.push(node.text ?? '');
      else if (node.type === 'hardBreak') parts.push(' ');
      else {
        if (BLOCKS.has(node.type)) parts.push(' ');
        walk(node.content);
        if (BLOCKS.has(node.type)) parts.push(' ');
      }
    }
  };
  walk(document?.content);
  return flatten(parts.join(''));
}

/**
 * About `length` characters of `text` around `match`, cut at word
 * boundaries and marked with "…" where text was left out; `highlight` is
 * the match inside the snippet. Without a match the text's start.
 */
export function snippetAround(
  text: string,
  match: TextRange | null,
  length = SNIPPET_LENGTH,
): { snippet: string; highlight: TextRange | null } {
  if (!match) {
    if (text.length <= length) return { snippet: text, highlight: null };
    const cut = text.lastIndexOf(' ', length);
    return {
      snippet: `${text.slice(0, cut > length / 2 ? cut : length).trimEnd()} …`,
      highlight: null,
    };
  }
  const room = Math.max(0, length - (match.end - match.start));
  let start = Math.max(0, match.start - Math.floor(room / 2));
  let end = Math.min(text.length, match.end + (room - (match.start - start)));
  // What one side cannot use goes to the other.
  start = Math.max(0, Math.min(start, end - length));
  // Never cut a word in two: move inwards to the next space.
  if (start > 0 && text[start - 1] !== ' ') {
    const space = text.indexOf(' ', start);
    start = space >= 0 && space < match.start ? space + 1 : start;
  }
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    end = space >= match.end ? space : end;
  }
  const head = start > 0 ? '… ' : '';
  const body = text.slice(start, end);
  return {
    snippet: `${head}${body}${end < text.length ? ' …' : ''}`,
    highlight: {
      start: head.length + match.start - start,
      end: head.length + match.end - start,
    },
  };
}

const DAY_MONTH = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const DAY_MONTH_YEAR = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const atNoon = (date: string) => new Date(`${date}T12:00:00.000Z`);

/** "18. Nov." in the current year, "18. Nov. 2025" in another one. */
export function shortDate(date: string, today: string): string {
  return (
    date.slice(0, 4) === today.slice(0, 4) ? DAY_MONTH : DAY_MONTH_YEAR
  ).format(atNoon(date));
}

/** "16.–22. Nov.", across months "30. Nov. – 6. Dez.", year as in shortDate. */
export function weekSpan(
  startDate: string,
  endDate: string,
  today: string,
): string {
  const end = shortDate(endDate, today);
  if (startDate.slice(0, 7) === endDate.slice(0, 7))
    return `${Number(startDate.slice(8))}.–${end}`;
  const start = DAY_MONTH.format(atNoon(startDate));
  return `${start} – ${end}`;
}
