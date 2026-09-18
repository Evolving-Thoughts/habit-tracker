import { HabitResponseDto } from '../dto/habit-response.dto';
import { HabitEntity } from '../entities/habit.entity';

export class HabitMapper {
  static toResponseDto(habit: HabitEntity): HabitResponseDto {
    return new HabitResponseDto({
      id: habit.id,
      title: habit.title,
      scheduleType: habit.scheduleType,
      startDate: habit.startDate,
      intervalDays: habit.intervalDays,
      weekdays: habit.weekdays,
      weeklyTarget: habit.weeklyTarget,
      missedOccurrencePolicy: habit.missedOccurrencePolicy,
      isActive: habit.isActive,
    });
  }
}
