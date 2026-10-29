import { Module } from '@nestjs/common';
import { HabitsModule } from '../habits/habits.module';
import { DayPlannerController } from './day-planner.controller';
import { DayPlannerService } from './day-planner.service';

@Module({
  imports: [HabitsModule],
  controllers: [DayPlannerController],
  providers: [DayPlannerService],
})
export class DayPlannerModule {}
