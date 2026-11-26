import { CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.dto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Put,
  Query,
} from '@nestjs/common';
import { DayPlannerService } from './day-planner.service';
import { DayPlannerResponseDto } from './dto/day-planner-response.dto';
import { EventDoneDto } from './dto/event-done.dto';
import { ReorderDayDto } from './dto/reorder-day.dto';
import { PlanQueryDto, WeekPlanResponseDto } from './dto/week-plan.dto';

@Controller('day-planner')
export class DayPlannerController {
  constructor(private readonly dayPlannerService: DayPlannerService) {}

  @Get('today')
  getToday(@CurrentUser() user: AuthUser): Promise<DayPlannerResponseDto> {
    return this.dayPlannerService.getToday(user.id);
  }

  @Get('plan')
  getPlan(
    @CurrentUser() user: AuthUser,
    @Query() query: PlanQueryDto,
  ): Promise<WeekPlanResponseDto> {
    return this.dayPlannerService.getPlan(user.id, query.from, query.days);
  }

  @Put('order')
  @HttpCode(204)
  reorder(
    @CurrentUser() user: AuthUser,
    @Body() dto: ReorderDayDto,
  ): Promise<void> {
    return this.dayPlannerService.reorder(user.id, dto.items);
  }

  /** Ticks a Google event off in the app; Google itself stays untouched. */
  @Put('events/:id/done')
  @HttpCode(204)
  setEventDone(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EventDoneDto,
  ): Promise<void> {
    return this.dayPlannerService.setEventDone(user.id, id, dto.done);
  }
}
