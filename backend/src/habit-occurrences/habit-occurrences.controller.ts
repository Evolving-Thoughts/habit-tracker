import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { HabitSchedulingService } from '../habits/scheduling/habit-scheduling.service';
import { HabitOccurrenceEntity } from './entities/habit-occurrence.entity';
import { HabitOccurrenceResponseDto } from './dto/habit-occurrence-response.dto';
import { UpdateOccurrenceStatusDto } from './dto/update-occurrence-status.dto';

function response(
  occurrence: HabitOccurrenceEntity,
): HabitOccurrenceResponseDto {
  return {
    id: occurrence.id,
    habitId: occurrence.habitId,
    scheduleVersionId: occurrence.scheduleVersionId,
    scheduledDate: occurrence.scheduledDate,
    status: occurrence.status,
    resolvedDate: occurrence.resolvedDate,
    cancellationReason: occurrence.cancellationReason,
  };
}

@Controller()
export class HabitOccurrencesController {
  constructor(private readonly scheduling: HabitSchedulingService) {}

  @Get('habit-occurrences/today')
  async findToday(): Promise<HabitOccurrenceResponseDto[]> {
    return (await this.scheduling.getToday()).map(response);
  }

  @Get('habits/:habitId/occurrences')
  async findByHabit(
    @Param('habitId', ParseIntPipe) habitId: number,
  ): Promise<HabitOccurrenceResponseDto[]> {
    return (await this.scheduling.history(habitId)).map(response);
  }

  @Patch('habit-occurrences/:id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOccurrenceStatusDto,
  ): Promise<HabitOccurrenceResponseDto> {
    return response(await this.scheduling.changeStatus(id, dto.status));
  }
}
