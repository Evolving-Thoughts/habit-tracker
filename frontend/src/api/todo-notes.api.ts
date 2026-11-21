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

// Shared by all editors, including a dialog reopened while its last save runs.
const pendingWrites = new Map<string, Promise<NotesResponse>>();

export async function getNotes(
  target: NotesTarget,
  signal?: AbortSignal,
): Promise<NotesDocument | null> {
  const path = notesPath(target);
  const pending = pendingWrites.get(path);
  if (pending) await pending.catch(() => undefined);
  return (await request<NotesResponse>(path, { signal })).notes;
}

/** Stores the notes; null clears them. Answers with what was stored. */
export async function setNotes(
  target: NotesTarget,
  notes: NotesDocument | null,
): Promise<NotesDocument | null> {
  const path = notesPath(target);
  const write = () =>
    request<NotesResponse>(path, {
      method: "PUT",
      body: JSON.stringify({ notes }),
    });
  const previous = pendingWrites.get(path);
  const pending = previous ? previous.then(write, write) : write();
  pendingWrites.set(path, pending);
  try {
    return (await pending).notes;
  } finally {
    if (pendingWrites.get(path) === pending) pendingWrites.delete(path);
  }
}
