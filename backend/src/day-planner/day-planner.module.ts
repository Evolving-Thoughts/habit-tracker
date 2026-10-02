import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HabitsModule } from '../habits/habits.module';
import { TodoEntity } from '../todos/entities/todo.entity';
import { DayPlannerController } from './day-planner.controller';
import { DayPlannerService } from './day-planner.service';

@Module({
  imports: [TypeOrmModule.forFeature([TodoEntity]), HabitsModule],
  controllers: [DayPlannerController],
  providers: [DayPlannerService],
})
export class DayPlannerModule {}
