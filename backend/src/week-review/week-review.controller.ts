import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.dto';
import { CurrentUser } from '../auth/auth.guard';
import { WeekQueryDto } from '../common/week-query.dto';
import {
  SaveWeekReviewDto,
  WeekReviewAnswers,
  WeekReviewResponse,
} from './week-review.dto';
import { WeekReviewService } from './week-review.service';

@Controller('week-review')
export class WeekReviewController {
  constructor(private readonly reviews: WeekReviewService) {}

  @Get()
  week(
    @CurrentUser() user: AuthUser,
    @Query() query: WeekQueryDto,
  ): Promise<WeekReviewResponse> {
    return this.reviews.week(user.id, query.week);
  }

  @Put(':week')
  save(
    @CurrentUser() user: AuthUser,
    @Param('week') week: string,
    @Body() dto: SaveWeekReviewDto,
  ): Promise<WeekReviewAnswers> {
    return this.reviews.save(user.id, week, dto);
  }
}
