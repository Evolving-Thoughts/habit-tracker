import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateHabitDto } from './dto/create-habit.dto';
import { HabitResponseDto } from './dto/habit-response.dto';
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

  @Post()
  async create(
    @Body() createHabitDto: CreateHabitDto,
  ): Promise<HabitResponseDto> {
    const habit = await this.habitsService.create(createHabitDto);

    return HabitMapper.toResponseDto(habit);
  }
}
