/**
 * Notes of a todo: a rich-text document in the editor's own JSON form
 * (Tiptap/ProseMirror). The server never renders it. It keeps only what the
 * editor can show, so a stored document cannot carry anything else: unknown
 * nodes, marks and attributes are dropped, and a link needs a harmless target.
 */
export type NotesMark = { type: string; attrs?: Record<string, unknown> };
export type NotesNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NotesNode[];
  marks?: NotesMark[];
  text?: string;
};
export type NotesDocument = { type: 'doc'; content: NotesNode[] };

/** The request is not a notes document, or it is too large to keep. */
export class InvalidNotesError extends Error {}

export const NOTES_MAX_LENGTH = 60_000;
const MAX_DEPTH = 24;
const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

type AttrRule = (value: unknown) => unknown;
const integerIn =
  (min: number, max: number, fallback: number): AttrRule =>
  (value) =>
    Number.isInteger(value) &&
    (value as number) >= min &&
    (value as number) <= max
      ? value
      : fallback;

/** Every node the editor knows, with the attributes it may carry. */
const NODES: Record<string, Record<string, AttrRule>> = {
  paragraph: {},
  heading: { level: integerIn(1, 3, 1) },
  blockquote: {},
  codeBlock: {
    language: (value) =>
      typeof value === 'string' && /^[\w+#.-]{1,40}$/.test(value)
        ? value
        : null,
  },
  bulletList: {},
  orderedList: { start: integerIn(1, 100_000, 1) },
  listItem: {},
  taskList: {},
  taskItem: { checked: (value) => value === true },
  horizontalRule: {},
  hardBreak: {},
  text: {},
};
const MARKS = new Set(['bold', 'italic', 'strike', 'code', 'underline']);

function cleanMark(mark: unknown): NotesMark | null {
  if (typeof mark !== 'object' || mark === null) return null;
  const { type, attrs } = mark as NotesMark;
  if (MARKS.has(type)) return { type };
  if (type !== 'link') return null;
  const href = attrs?.href;
  return typeof href === 'string' && SAFE_LINK.test(href) && href.length <= 2000
    ? { type: 'link', attrs: { href } }
    : null;
}

function cleanNode(node: unknown, depth: number): NotesNode | null {
  if (typeof node !== 'object' || node === null || depth > MAX_DEPTH)
    return null;
  const { type, attrs, content, marks, text } = node as NotesNode;
  const rules = typeof type === 'string' ? NODES[type] : undefined;
  if (!rules) return null;
  if (type === 'text') {
    if (typeof text !== 'string' || text === '') return null;
    const kept = Array.isArray(marks)
      ? marks.flatMap((mark) => cleanMark(mark) ?? [])
      : [];
    return kept.length ? { type, text, marks: kept } : { type, text };
  }
  const result: NotesNode = { type };
  const names = Object.keys(rules);
  if (names.length)
    result.attrs = Object.fromEntries(
      names.map((name) => [name, rules[name](attrs?.[name])]),
    );
  if (Array.isArray(content)) {
    const children = content.flatMap(
      (child) => cleanNode(child, depth + 1) ?? [],
    );
    if (children.length) result.content = children;
  }
  return result;
}

function hasText(nodes: NotesNode[]): boolean {
  return nodes.some(
    (node) =>
      (node.type === 'text' && node.text!.trim() !== '') ||
      (node.content !== undefined && hasText(node.content)),
  );
}

/**
 * The document reduced to what the editor can show; null when nothing is
 * written in it. Throws InvalidNotesError for anything that is not a notes
 * document or is too large.
 */
export function cleanNotes(input: unknown): NotesDocument | null {
  if (input === null || input === undefined) return null;
  const root = input as Partial<NotesDocument>;
  if (
    typeof input !== 'object' ||
    root.type !== 'doc' ||
    (root.content !== undefined && !Array.isArray(root.content))
  )
    throw new InvalidNotesError('Notes must be a document');
  const content = (root.content ?? []).flatMap(
    (node) => cleanNode(node, 1) ?? [],
  );
  if (!hasText(content)) return null;
  const document: NotesDocument = { type: 'doc', content };
  if (JSON.stringify(document).length > NOTES_MAX_LENGTH)
    throw new InvalidNotesError('Notes are too long');
  return document;
}
