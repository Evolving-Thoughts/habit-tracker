/**
 * Dictated text into a text field (docs/voice-input.md): at the cursor, or
 * replacing the selection, with a space towards a word on either side. With
 * a limit, the dictated part is cut to what still fits.
 */
export type Insertion = {
  value: string;
  /** Where the cursor goes: right after the inserted text. */
  caret: number;
  /** The dictated text did not fit whole. */
  truncated: boolean;
};

export function insertText(
  value: string,
  text: string,
  range: { start?: number; end?: number; max?: number } = {},
): Insertion {
  const start = range.start ?? value.length;
  const end = range.end ?? start;
  const max = range.max ?? Infinity;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const lead = before && !/\s$/u.test(before) ? " " : "";
  const trail = after && !/^\s/u.test(after) ? " " : "";
  let middle = `${lead}${text}${trail}`;
  const room = max - before.length - after.length;
  const truncated = middle.length > room;
  if (truncated) middle = middle.slice(0, Math.max(0, room)).trimEnd();
  return {
    value: before + middle + after,
    caret: before.length + middle.length,
    truncated,
  };
}

/** Inserts into a field element's current selection (its value given separately). */
export function insertAtCursor(
  field: HTMLTextAreaElement | HTMLInputElement | null,
  value: string,
  text: string,
  max?: number,
): Insertion {
  const start = field?.selectionStart ?? value.length;
  const end = field?.selectionEnd ?? start;
  return insertText(value, text, { start, end, max });
}
