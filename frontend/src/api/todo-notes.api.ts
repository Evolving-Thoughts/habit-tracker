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

export async function getTodoNotes(
  todoId: number,
  signal?: AbortSignal,
): Promise<NotesDocument | null> {
  return (await request<NotesResponse>(`/todos/${todoId}/notes`, { signal }))
    .notes;
}

/** Stores the notes; null clears them. Answers with what was stored. */
export async function setTodoNotes(
  todoId: number,
  notes: NotesDocument | null,
): Promise<NotesDocument | null> {
  return (
    await request<NotesResponse>(`/todos/${todoId}/notes`, {
      method: "PUT",
      body: JSON.stringify({ notes }),
    })
  ).notes;
}
