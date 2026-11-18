import type { ShortcutId } from "./shortcuts";

/** One entry of the command menu. */
export type Command = {
  id: string;
  label: string;
  group: "Ansichten" | "Aktionen";
  /** The shortcut that does the same, shown beside the entry. */
  shortcut?: ShortcutId;
  /** Further words it is found by, e.g. "Timer" for the stopwatch. */
  keywords?: readonly string[];
  run: () => void;
};

/** Lower case without accents, so "ruckblick" finds "Rückblick". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .trim();
}

function words(command: Command): string[] {
  return normalize([command.label, ...(command.keywords ?? [])].join(" "))
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * 0 when every typed word starts a word of the entry, 1 when each is at
 * least somewhere inside it, null when one is missing.
 */
function rank(command: Command, terms: string[]): number | null {
  const own = words(command);
  const text = own.join(" ");
  let result = 0;
  for (const term of terms) {
    if (own.some((word) => word.startsWith(term))) continue;
    if (!text.includes(term)) return null;
    result = 1;
  }
  return result;
}

/**
 * The commands a query finds: matches at word starts first, then matches
 * inside words, each in the menu's own order. An empty query keeps all.
 */
export function filterCommands(
  commands: readonly Command[],
  query: string,
): Command[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [...commands];
  return commands
    .map((command, index) => ({ command, index, rank: rank(command, terms) }))
    .filter(
      (entry): entry is { command: Command; index: number; rank: number } =>
        entry.rank !== null,
    )
    .sort(
      (first, second) => first.rank - second.rank || first.index - second.index,
    )
    .map(({ command }) => command);
}
