import { IsObject, IsOptional } from 'class-validator';
import type { NotesDocument } from '../todo-notes';

/** PUT /todos/:id/notes: the editor's document, or null to clear the notes. */
export class SetTodoNotesDto {
  @IsOptional()
  @IsObject()
  readonly notes?: object | null;
}

/** What both notes endpoints answer with. */
export type TodoNotesResponse = { notes: NotesDocument | null };
