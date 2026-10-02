import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrencesController } from '../habit-occurrences/habit-occurrences.controller';
import { HabitEntity } from './entities/habit.entity';
import { HabitScheduleVersionEntity } from './entities/habit-schedule-version.entity';
import { HabitsController } from './habits.controller';
import { HabitsService } from './habits.service';
import { HabitSchedulingService } from './scheduling/habit-scheduling.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HabitEntity,
      HabitScheduleVersionEntity,
      HabitOccurrenceEntity,
    ]),
  ],
  controllers: [HabitsController, HabitOccurrencesController],
  providers: [HabitsService, HabitSchedulingService],
  exports: [HabitSchedulingService],
})
export class HabitsModule {}
