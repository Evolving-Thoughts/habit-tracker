import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { HabitOccurrenceGeneratorService } from './habit-occurrence-generator.service';
import { HabitOccurrenceResponseDto } from './dto/habit-occurrence-response.dto';
import { UpdateOccurrenceStatusDto } from './dto/update-occurrence-status.dto';
import { HabitOccurrenceMapper } from './mappers/habit-occurrence.mapper';
import { HabitOccurrencesService } from './habit-occurrences.service';

@Controller()
export class HabitOccurrencesController {
  constructor(
    private readonly occurrenceService: HabitOccurrencesService,
    private readonly generatorService: HabitOccurrenceGeneratorService,
  ) {}

  @Get('habit-occurrences/today')
  async findToday(): Promise<HabitOccurrenceResponseDto[]> {
    const occurrences = await this.generatorService.generateToday();

    return occurrences.map((occurrence) =>
      HabitOccurrenceMapper.toResponseDto(occurrence),
    );
  }

  @Get('habits/:habitId/occurrences')
  async findByHabit(
    @Param('habitId', ParseIntPipe) habitId: number,
  ): Promise<HabitOccurrenceResponseDto[]> {
    const occurrences = await this.occurrenceService.findByHabit(habitId);

    return occurrences.map((occurrence) =>
      HabitOccurrenceMapper.toResponseDto(occurrence),
    );
  }

  @Patch('habit-occurrences/:id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    updateStatusDto: UpdateOccurrenceStatusDto,
  ): Promise<HabitOccurrenceResponseDto> {
    const occurrence = await this.occurrenceService.updateStatus(
      id,
      updateStatusDto.status,
    );

    return HabitOccurrenceMapper.toResponseDto(occurrence);
  }
}
