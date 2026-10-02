import { HabitEntity } from '../entities/habit.entity';
import { HabitScheduleVersionEntity } from '../entities/habit-schedule-version.entity';
import { HabitScheduleType } from '../enums/habit-schedule-type.enum';

type InitialHabitSchedule = Pick<
  HabitEntity,
  | 'id'
  | 'scheduleType'
  | 'startDate'
  | 'intervalDays'
  | 'weekdays'
  | 'weeklyTarget'
  | 'missedOccurrencePolicy'
>;

/**
 * Erstellt die erste, noch nicht gespeicherte Regelversion
 * eines neuen Habits.
 *
 * Voraussetzung: Die Habit-Regel wurde bereits validiert.
 */
export function createInitialScheduleVersion(
  habit: InitialHabitSchedule,
): HabitScheduleVersionEntity {
  const version = new HabitScheduleVersionEntity();

  version.habitId = habit.id;
  version.scheduleType = habit.scheduleType;

  version.validFrom = habit.startDate;
  version.validUntil = null;

  version.firstDueDate =
    habit.scheduleType === HabitScheduleType.INTERVAL ? habit.startDate : null;

  version.intervalDays = habit.intervalDays;

  version.weekdays = habit.weekdays === null ? null : [...habit.weekdays];

  version.weeklyTarget = habit.weeklyTarget;
  version.missedOccurrencePolicy = habit.missedOccurrencePolicy;

  return version;
}
