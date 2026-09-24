import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HabitEntity } from '../habits/entities/habit.entity';
import { HabitOccurrenceEntity } from './entities/habit-occurrence.entity';
import { HabitOccurrenceGeneratorService } from './habit-occurrence-generator.service';
import { HabitOccurrencesController } from './habit-occurrences.controller';
import { HabitOccurrencesService } from './habit-occurrences.service';

@Module({
  imports: [TypeOrmModule.forFeature([HabitEntity, HabitOccurrenceEntity])],
  controllers: [HabitOccurrencesController],
  providers: [HabitOccurrencesService, HabitOccurrenceGeneratorService],
  exports: [HabitOccurrencesService, HabitOccurrenceGeneratorService],
})
export class HabitOccurrencesModule {}
