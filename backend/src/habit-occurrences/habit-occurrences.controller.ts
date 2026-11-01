import { CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.dto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { HabitSchedulingService } from '../habits/scheduling/habit-scheduling.service';
import { HabitOccurrenceEntity } from './entities/habit-occurrence.entity';
import { HabitOccurrenceResponseDto } from './dto/habit-occurrence-response.dto';
import { RescheduleOccurrenceDto } from './dto/reschedule-occurrence.dto';
import { UpdateOccurrenceStatusDto } from './dto/update-occurrence-status.dto';

function response(
  occurrence: HabitOccurrenceEntity,
): HabitOccurrenceResponseDto {
  return {
    id: occurrence.id,
    habitId: occurrence.habitId,
    scheduleVersionId: occurrence.scheduleVersionId,
    scheduledDate: occurrence.scheduledDate,
    movedToDate: occurrence.movedToDate,
    status: occurrence.status,
    resolvedDate: occurrence.resolvedDate,
    cancellationReason: occurrence.cancellationReason,
  };
}

@Controller()
export class HabitOccurrencesController {
  constructor(private readonly scheduling: HabitSchedulingService) {}

  @Get('habit-occurrences/today')
  async findToday(
    @CurrentUser() user: AuthUser,
  ): Promise<HabitOccurrenceResponseDto[]> {
    return (await this.scheduling.getToday(user.id)).map(response);
  }

  @Get('habits/:habitId/occurrences')
  async findByHabit(
    @CurrentUser() user: AuthUser,
    @Param('habitId', ParseIntPipe) habitId: number,
  ): Promise<HabitOccurrenceResponseDto[]> {
    return (await this.scheduling.history(user.id, habitId)).map(response);
  }

  @Post('habit-occurrences/:id/reschedule')
  @HttpCode(HttpStatus.OK)
  async reschedule(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RescheduleOccurrenceDto,
  ): Promise<HabitOccurrenceResponseDto> {
    return response(await this.scheduling.reschedule(user.id, id, dto.date));
  }

  @Patch('habit-occurrences/:id/status')
  async updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOccurrenceStatusDto,
  ): Promise<HabitOccurrenceResponseDto> {
    return response(
      await this.scheduling.changeStatus(user.id, id, dto.status),
    );
  }
}
