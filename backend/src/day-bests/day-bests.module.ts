import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DayBestEntity, DayBestSettingsEntity } from './day-best.entities';
import {
  DayBestSettingsController,
  DayBestsController,
} from './day-bests.controller';
import { DayBestsService } from './day-bests.service';

@Module({
  imports: [TypeOrmModule.forFeature([DayBestEntity, DayBestSettingsEntity])],
  controllers: [DayBestsController, DayBestSettingsController],
  providers: [DayBestsService],
})
export class DayBestsModule {}
