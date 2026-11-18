import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeekReviewController } from './week-review.controller';
import { WeekReviewEntity } from './week-review.entity';
import { WeekReviewService } from './week-review.service';

@Module({
  imports: [TypeOrmModule.forFeature([WeekReviewEntity])],
  controllers: [WeekReviewController],
  providers: [WeekReviewService],
})
export class WeekReviewModule {}
