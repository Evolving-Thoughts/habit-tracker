import { CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.dto';
import { Body, Controller, Get, HttpCode, Put } from '@nestjs/common';
import { DayPlannerService } from './day-planner.service';
import { DayPlannerResponseDto } from './dto/day-planner-response.dto';
import { ReorderDayDto } from './dto/reorder-day.dto';

@Controller('day-planner')
export class DayPlannerController {
  constructor(private readonly dayPlannerService: DayPlannerService) {}

  @Get('today')
  getToday(@CurrentUser() user: AuthUser): Promise<DayPlannerResponseDto> {
    return this.dayPlannerService.getToday(user.id);
  }

  @Put('order')
  @HttpCode(204)
  reorder(
    @CurrentUser() user: AuthUser,
    @Body() dto: ReorderDayDto,
  ): Promise<void> {
    return this.dayPlannerService.reorder(user.id, dto.items);
  }
}
