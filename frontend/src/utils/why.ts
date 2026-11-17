import type { InheritedWhy } from "../types/todo";

type WithWhy = { why: string | null; inheritedWhy: InheritedWhy | null };

/** The reason an entry shows: its own, else the one it inherits. */
export function shownWhy(entry: WithWhy): string | null {
  return entry.why ?? entry.inheritedWhy?.text ?? null;
}

/** What a new entry directly below `parent` would inherit. */
export function whyBelow(
  parent: WithWhy & { id: number; title: string },
): InheritedWhy | null {
  return parent.why
    ? { text: parent.why, fromId: parent.id, fromTitle: parent.title }
    : parent.inheritedWhy;
}
