import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.dto';
import { CurrentUser } from '../auth/auth.guard';
import { WeekQueryDto } from '../common/week-query.dto';
import {
  QuestHoursResponse,
  QuestTargetDto,
  QuestTargetResponse,
} from './quest-hours.dto';
import { QuestHoursService } from './quest-hours.service';

@Controller('quest-hours')
export class QuestHoursController {
  constructor(private readonly questHours: QuestHoursService) {}

  @Get()
  week(
    @CurrentUser() user: AuthUser,
    @Query() query: WeekQueryDto,
  ): Promise<QuestHoursResponse> {
    return this.questHours.week(user.id, query.week);
  }

  @Get('target')
  target(@CurrentUser() user: AuthUser): Promise<QuestTargetResponse> {
    return this.questHours.target(user.id);
  }

  @Put('target')
  setTarget(
    @CurrentUser() user: AuthUser,
    @Body() dto: QuestTargetDto,
  ): Promise<QuestTargetResponse> {
    return this.questHours.setTarget(user.id, dto.weeklyTargetMinutes);
  }
}
