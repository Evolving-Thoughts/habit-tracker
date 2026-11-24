/**
 * Campaigns and categories named in a quest typed or dictated in German
 * ("Kapitel 4 gliedern Kampagne Buch schreiben Kategorie Schreiben"), for
 * `parseQuest`. Conservative: a name only counts after its keyword
 * ("Kampagne …", "zur Kampagne …", "in der Kategorie …"), or a campaign
 * after "für" when it is spelt exactly. A bare name never counts, so a
 * category called "Lesen" leaves "Lesen üben" alone.
 *
 * Names compare without case, umlauts (ä = ae), ß (= ss), accents and
 * punctuation, so dictation and typing meet. After a keyword one small
 * recognition error is forgiven in names of five letters or more.
 */

/** A campaign or category the text may name; `icon`/`mark` only ride along. */
export type NamedEntry = {
  id: number;
  name: string;
  icon?: string | null;
  mark?: string | null;
};

export type NamedFind = {
  entry: NamedEntry;
  /** Range in the text: keyword and connecting words included. */
  start: number;
  end: number;
};

type Token = { norm: string; start: number; end: number };
type Prepared = { entry: NamedEntry; tokens: string[]; joined: string };

/** Lower case without umlauts, ß and accents: "Größe" and "groesse" meet. */
export function normaliseName(word: string): string {
  return word
    .toLocaleLowerCase("de-DE")
    .replace(/ä/gu, "ae")
    .replace(/ö/gu, "oe")
    .replace(/ü/gu, "ue")
    .replace(/ß/gu, "ss")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

// Words and numbers; "&" and "+" are said as "und".
const TOKEN = /[\p{L}\p{N}]+|[&+]/gu;

function tokenize(text: string): Token[] {
  return [...text.matchAll(TOKEN)].map((match) => ({
    norm: match[0] === "&" || match[0] === "+" ? "und" : normaliseName(match[0]),
    start: match.index,
    end: match.index + match[0].length,
  }));
}

/** Edit distance; stops early once it is past `limit`. */
function distance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const value = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      current.push(value);
      best = Math.min(best, value);
    }
    if (best > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length]!;
}

const prepared = new WeakMap<readonly NamedEntry[], Prepared[]>();
function prepare(entries: readonly NamedEntry[]): Prepared[] {
  let list = prepared.get(entries);
  if (!list) {
    list = entries
      .map((entry) => {
        const tokens = tokenize(entry.name).map((token) => token.norm);
        return { entry, tokens, joined: tokens.join("") };
      })
      .filter((item) => item.tokens.length > 0);
    prepared.set(entries, list);
  }
  return list;
}

/** A comma, a colon or a bracket ends a name: it never reaches across. */
const joinable = (text: string, left: Token, right: Token) =>
  !/[,;:!?()[\]]/u.test(text.slice(left.end, right.start));

/** One recognition error in names of five letters or more. */
const tolerance = (joined: string) => (joined.length >= 5 ? 1 : 0);

/**
 * The entry named by the tokens from `from` on. Fuzzy: a window of one word
 * more or less than the name may match (speech splits and joins words), a
 * small error is forgiven. Longest name wins; an error costs as much as
 * two letters, so "Buch" spelt exactly beats "Buche" one letter off.
 */
function nameAt(
  text: string,
  tokens: Token[],
  from: number,
  entries: Prepared[],
  fuzzy: boolean,
): { entry: NamedEntry; last: number } | null {
  let best: { entry: NamedEntry; last: number; score: number } | null = null;
  for (const item of entries) {
    const size = item.tokens.length;
    const sizes = fuzzy ? [size, size - 1, size + 1] : [size];
    let found: { last: number; errors: number } | null = null;
    for (const words of sizes) {
      const last = from + words - 1;
      if (words < 1 || last >= tokens.length) continue;
      let connected = true;
      for (let index = from; index < last; index++)
        if (!joinable(text, tokens[index]!, tokens[index + 1]!)) connected = false;
      if (!connected) continue;
      const window = tokens.slice(from, last + 1).map((token) => token.norm);
      const errors = fuzzy
        ? distance(window.join(""), item.joined, tolerance(item.joined))
        : window.join(" ") === item.tokens.join(" ")
          ? 0
          : 1;
      if (errors > (fuzzy ? tolerance(item.joined) : 0)) continue;
      // Fewest errors; at a tie the name's own word count (listed first).
      if (!found || errors < found.errors) found = { last, errors };
    }
    if (!found) continue;
    const score = item.joined.length - 2 * found.errors;
    if (!best || score > best.score)
      best = { entry: item.entry, last: found.last, score };
  }
  return best && { entry: best.entry, last: best.last };
}

// Before the keyword, longest first: "für die Kampagne", "in der Kategorie".
const LEAD_INS = [
  ["fuer", "die"],
  ["fuer", "den"],
  ["fuer", "das"],
  ["fuer", "der"],
  ["zu", "der"],
  ["in", "der"],
  ["in", "die"],
  ["in", "den"],
  ["mit", "der"],
  ["fuer"],
  ["zur"],
  ["zum"],
  ["in"],
  ["mit"],
  ["unter"],
];

/** Where the phrase starts: lead-in words right before the keyword count. */
function leadIn(text: string, tokens: Token[], keyword: number): number {
  for (const words of LEAD_INS) {
    const first = keyword - words.length;
    if (first < 0) continue;
    const fits = words.every(
      (word, offset) =>
        tokens[first + offset]!.norm === word &&
        /^\s+$/u.test(
          text.slice(tokens[first + offset]!.end, tokens[first + offset + 1]!.start),
        ),
    );
    if (fits) return tokens[first]!.start;
  }
  return tokens[keyword]!.start;
}

/** A closing quote right after the name goes with it. */
function closeQuote(text: string, end: number): number {
  const quote = /^["'”“‘’»«]/u.exec(text.slice(end));
  return quote ? end + quote[0].length : end;
}

/**
 * The first entry named after `keyword` ("kampagne", "kategorie"); the
 * keyword itself may carry one error or a plural "n".
 */
export function findAfterKeyword(
  text: string,
  keyword: string,
  entries: readonly NamedEntry[],
): NamedFind | null {
  const list = prepare(entries);
  if (!list.length) return null;
  const tokens = tokenize(text);
  for (let index = 0; index < tokens.length - 1; index++) {
    if (distance(tokens[index]!.norm, keyword, 1) > 1) continue;
    if (!joinable(text, tokens[index]!, tokens[index + 1]!)) continue;
    const found = nameAt(text, tokens, index + 1, list, true);
    if (found)
      return {
        entry: found.entry,
        start: leadIn(text, tokens, index),
        end: closeQuote(text, tokens[found.last]!.end),
      };
  }
  return null;
}

/** "für Buch schreiben": a campaign after "für", spelt exactly. */
export function findAfterFuer(
  text: string,
  entries: readonly NamedEntry[],
): NamedFind | null {
  const list = prepare(entries);
  if (!list.length) return null;
  const tokens = tokenize(text);
  for (let index = 0; index < tokens.length - 1; index++) {
    if (tokens[index]!.norm !== "fuer") continue;
    if (!/^\s+$/u.test(text.slice(tokens[index]!.end, tokens[index + 1]!.start)))
      continue;
    const found = nameAt(text, tokens, index + 1, list, false);
    if (found)
      return {
        entry: found.entry,
        start: tokens[index]!.start,
        end: closeQuote(text, tokens[found.last]!.end),
      };
  }
  return null;
}
