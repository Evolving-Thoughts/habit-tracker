import { HabitOccurrenceResponseDto } from '../dto/habit-occurrence-response.dto';
import { HabitOccurrenceEntity } from '../entities/habit-occurrence.entity';

export class HabitOccurrenceMapper {
  static toResponseDto(
    occurrence: HabitOccurrenceEntity,
  ): HabitOccurrenceResponseDto {
    return new HabitOccurrenceResponseDto({
      id: occurrence.id,
      habitId: occurrence.habitId,
      scheduledDate: occurrence.scheduledDate,
      status: occurrence.status,
      resolvedDate: occurrence.resolvedDate,
    });
  }
}
