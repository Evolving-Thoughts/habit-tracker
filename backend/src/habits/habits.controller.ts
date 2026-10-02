import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateHabitDto } from './dto/create-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import { ChangeHabitScheduleDto } from './dto/change-habit-schedule.dto';
import {
  HabitResponseDto,
  ScheduleVersionResponse,
} from './dto/habit-response.dto';
import { HabitsService } from './habits.service';

@Controller('habits')
export class HabitsController {
  constructor(private readonly service: HabitsService) {}

  @Get()
  findAll(): Promise<HabitResponseDto[]> {
    return this.service.findAll();
  }

  @Get(':id/schedule-versions')
  findVersions(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ScheduleVersionResponse[]> {
    return this.service.findVersions(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<HabitResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateHabitDto): Promise<HabitResponseDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHabitDto,
  ): Promise<HabitResponseDto> {
    return this.service.update(id, dto);
  }

  @Post(':id/schedule-changes')
  changeSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeHabitScheduleDto,
  ): Promise<HabitResponseDto> {
    return this.service.changeSchedule(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
