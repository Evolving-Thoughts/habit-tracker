import { DataSource } from 'typeorm';
import { HabitOccurrenceEntity } from '../../src/habit-occurrences/entities/habit-occurrence.entity';
import { HabitScheduleVersionEntity } from '../../src/habits/entities/habit-schedule-version.entity';
import { HabitEntity } from '../../src/habits/entities/habit.entity';

/**
 * Löscht ausschließlich Habit-Testdaten.
 * Todos bleiben unverändert.
 */
export async function clearHabitTestData(
  dataSource: DataSource,
): Promise<void> {
  if (dataSource.options.database !== 'habit_tracker_test') {
    throw new Error('Refusing to delete data outside habit_tracker_test.');
  }

  await dataSource.transaction(async (manager) => {
    await manager
      .getRepository(HabitOccurrenceEntity)
      .createQueryBuilder()
      .delete()
      .execute();

    await manager
      .getRepository(HabitScheduleVersionEntity)
      .createQueryBuilder()
      .delete()
      .execute();

    await manager
      .getRepository(HabitEntity)
      .createQueryBuilder()
      .delete()
      .execute();
  });
}
