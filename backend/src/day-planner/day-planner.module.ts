import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HabitOccurrencesModule } from '../habit-occurrences/habit-occurrences.module';
import { TodoEntity } from '../todos/entities/todo.entity';
import { DayPlannerController } from './day-planner.controller';
import { DayPlannerService } from './day-planner.service';

@Module({
  imports: [TypeOrmModule.forFeature([TodoEntity]), HabitOccurrencesModule],
  controllers: [DayPlannerController],
  providers: [DayPlannerService],
})
export class DayPlannerModule {}
