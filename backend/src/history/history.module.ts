import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TodoEntity } from '../todos/entities/todo.entity';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { HistoryController } from './history.controller';
import { HistoryService } from './history.service';
@Module({
  imports: [TypeOrmModule.forFeature([TodoEntity, HabitOccurrenceEntity])],
  controllers: [HistoryController],
  providers: [HistoryService],
})
export class HistoryModule {}
