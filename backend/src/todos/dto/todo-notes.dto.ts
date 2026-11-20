import { IsObject, IsOptional } from 'class-validator';
import type { NotesDocument } from '../todo-notes';

/**
 * PUT /todos/:id/notes and PUT /habit-occurrences/:id/notes: the editor's
 * document, or null to clear the notes.
 */
export class SetNotesDto {
  @IsOptional()
  @IsObject()
  readonly notes?: object | null;
}

/** What both notes endpoints answer with. */
export type NotesResponse = { notes: NotesDocument | null };
