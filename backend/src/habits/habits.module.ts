import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HabitEntity } from './entities/habit.entity';
import { HabitsController } from './habits.controller';
import { HabitsService } from './habits.service';

@Module({
  imports: [TypeOrmModule.forFeature([HabitEntity])],
  controllers: [HabitsController],
  providers: [HabitsService],
})
export class HabitsModule {}
