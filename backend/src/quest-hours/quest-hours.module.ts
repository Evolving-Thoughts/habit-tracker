import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestHoursController } from './quest-hours.controller';
import { QuestHoursService } from './quest-hours.service';
import { WeeklyQuestTargetEntity } from './weekly-quest-target.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WeeklyQuestTargetEntity])],
  controllers: [QuestHoursController],
  providers: [QuestHoursService],
})
export class QuestHoursModule {}
