import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import {
  cleanNotes,
  InvalidNotesError,
  NotesDocument,
} from '../todos/todo-notes';
import { HabitOccurrenceEntity } from './entities/habit-occurrence.entity';
import { ownedOccurrences } from './owned-occurrences';

/**
 * Notes of one stored run of a daily: the same document and the same rules
 * as a todo's notes (`todos/todo-notes.ts`). A run the calendar only
 * foresees has no row yet, so it has no notes either.
 */
@Injectable()
export class OccurrenceNotesService {
  constructor(
    private readonly db: DataSource,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  async notes(userId: string, id: number): Promise<NotesDocument | null> {
    const run = await ownedOccurrences(this.db.manager, userId)
      .select(['occurrence.id'])
      .addSelect('occurrence.notes')
      .andWhere('occurrence.id = :id', { id })
      .getOne();
    if (!run) throw notFound(id);
    return run.notes ?? null;
  }

  /** Stores the notes reduced to what the editor can show. */
  setNotes(
    userId: string,
    id: number,
    input: unknown,
  ): Promise<NotesDocument | null> {
    let notes: NotesDocument | null;
    try {
      notes = cleanNotes(input);
    } catch (error) {
      if (error instanceof InvalidNotesError)
        throw new BadRequestException(error.message);
      throw error;
    }
    return this.unitOfWork.run(userId, async (manager) => {
      const run = await ownedOccurrences(manager, userId)
        .andWhere('occurrence.id = :id', { id })
        .getOne();
      if (!run) throw notFound(id);
      run.notes = notes;
      await manager.getRepository(HabitOccurrenceEntity).save(run);
      return notes;
    });
  }
}

const notFound = (id: number) =>
  new NotFoundException(`Habit occurrence with ID ${id} was not found`);
