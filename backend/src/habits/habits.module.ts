import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrencesController } from '../habit-occurrences/habit-occurrences.controller';
import { OccurrenceNotesService } from '../habit-occurrences/occurrence-notes.service';
import { HabitEntity } from './entities/habit.entity';
import { HabitScheduleVersionEntity } from './entities/habit-schedule-version.entity';
import { HabitsController } from './habits.controller';
import { HabitsService } from './habits.service';
import { HabitSchedulingService } from './scheduling/habit-scheduling.service';
import { HabitForecastPlaceEntity } from './entities/habit-forecast-place.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HabitEntity,
      HabitScheduleVersionEntity,
      HabitOccurrenceEntity,
      HabitForecastPlaceEntity,
    ]),
  ],
  controllers: [HabitsController, HabitOccurrencesController],
  providers: [HabitsService, HabitSchedulingService, OccurrenceNotesService],
  exports: [HabitSchedulingService],
})
export class HabitsModule {}
