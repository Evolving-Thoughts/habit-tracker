import { Module } from '@nestjs/common';
import { QuestHoursController } from './quest-hours.controller';
import { QuestHoursService } from './quest-hours.service';

@Module({
  controllers: [QuestHoursController],
  providers: [QuestHoursService],
})
export class QuestHoursModule {}
