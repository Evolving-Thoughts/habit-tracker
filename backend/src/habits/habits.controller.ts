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
import { HabitResponseDto } from './dto/habit-response.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import { HabitMapper } from './mappers/habit.mapper';
import { HabitsService } from './habits.service';

@Controller('habits')
export class HabitsController {
  constructor(private readonly habitsService: HabitsService) {}

  @Get()
  async findAll(): Promise<HabitResponseDto[]> {
    const habits = await this.habitsService.findAll();

    return habits.map((habit) => HabitMapper.toResponseDto(habit));
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<HabitResponseDto> {
    const habit = await this.habitsService.findOne(id);

    return HabitMapper.toResponseDto(habit);
  }

  @Post()
  async create(
    @Body() createHabitDto: CreateHabitDto,
  ): Promise<HabitResponseDto> {
    const habit = await this.habitsService.create(createHabitDto);

    return HabitMapper.toResponseDto(habit);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateHabitDto: UpdateHabitDto,
  ): Promise<HabitResponseDto> {
    const habit = await this.habitsService.update(id, updateHabitDto);

    return HabitMapper.toResponseDto(habit);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.habitsService.remove(id);
  }
}
