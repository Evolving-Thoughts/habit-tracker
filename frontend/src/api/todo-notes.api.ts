import { request } from "./http";

/** Rich-text notes as the editor's own document; the server stores it as is. */
export type NotesNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NotesNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};
export type NotesDocument = { type: "doc"; content?: NotesNode[] };

type NotesResponse = { notes: NotesDocument | null };

/** Whose notes: a quest, or one run of a daily. */
export type NotesTarget = { kind: "todo" | "occurrence"; id: number };

const notesPath = ({ kind, id }: NotesTarget): string =>
  kind === "todo" ? `/todos/${id}/notes` : `/habit-occurrences/${id}/notes`;

export async function getNotes(
  target: NotesTarget,
  signal?: AbortSignal,
): Promise<NotesDocument | null> {
  return (await request<NotesResponse>(notesPath(target), { signal })).notes;
}

/** Stores the notes; null clears them. Answers with what was stored. */
export async function setNotes(
  target: NotesTarget,
  notes: NotesDocument | null,
): Promise<NotesDocument | null> {
  return (
    await request<NotesResponse>(notesPath(target), {
      method: "PUT",
      body: JSON.stringify({ notes }),
    })
  ).notes;
}
