import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateHabitDto } from './dto/create-habit.dto';
import { HabitEntity } from './entities/habit.entity';
import { HabitScheduleType } from './enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from './enums/missed-occurrence-policy.enum';
import { Weekday } from './enums/weekday.enum';

@Injectable()
export class HabitsService {
  constructor(
    @InjectRepository(HabitEntity)
    private readonly habitRepository: Repository<HabitEntity>,
  ) {}

  findAll(): Promise<HabitEntity[]> {
    return this.habitRepository.find({
      order: {
        id: 'ASC',
      },
    });
  }

  async create(createHabitDto: CreateHabitDto): Promise<HabitEntity> {
    const startDate =
      createHabitDto.startDate ??
      this.getCurrentDateInTimeZone('Europe/Berlin');

    const intervalDays = createHabitDto.intervalDays ?? null;

    const weekdays = createHabitDto.weekdays ?? null;

    const weeklyTarget = createHabitDto.weeklyTarget ?? null;

    this.validateSchedule({
      scheduleType: createHabitDto.scheduleType,
      intervalDays,
      weekdays,
      weeklyTarget,
    });

    const habit = this.habitRepository.create({
      title: createHabitDto.title,
      scheduleType: createHabitDto.scheduleType,
      startDate,
      intervalDays,
      weekdays,
      weeklyTarget,
      missedOccurrencePolicy:
        createHabitDto.missedOccurrencePolicy ??
        MissedOccurrencePolicy.CARRY_OVER,
      isActive: true,
    });

    return this.habitRepository.save(habit);
  }

  private validateSchedule(schedule: {
    scheduleType: HabitScheduleType;
    intervalDays: number | null;
    weekdays: Weekday[] | null;
    weeklyTarget: number | null;
  }): void {
    switch (schedule.scheduleType) {
      case HabitScheduleType.INTERVAL:
        if (schedule.intervalDays === null) {
          throw new BadRequestException(
            'An interval habit requires intervalDays',
          );
        }

        if (schedule.weekdays !== null || schedule.weeklyTarget !== null) {
          throw new BadRequestException(
            'An interval habit only accepts intervalDays',
          );
        }

        return;

      case HabitScheduleType.FIXED_WEEKDAYS:
        if (schedule.weekdays === null || schedule.weekdays.length === 0) {
          throw new BadRequestException(
            'A fixed-weekday habit requires at least one weekday',
          );
        }

        if (schedule.intervalDays !== null || schedule.weeklyTarget !== null) {
          throw new BadRequestException(
            'A fixed-weekday habit only accepts weekdays',
          );
        }

        return;

      case HabitScheduleType.WEEKLY_TARGET:
        if (schedule.weeklyTarget === null) {
          throw new BadRequestException(
            'A weekly-target habit requires weeklyTarget',
          );
        }

        if (schedule.intervalDays !== null || schedule.weekdays !== null) {
          throw new BadRequestException(
            'A weekly-target habit only accepts weeklyTarget',
          );
        }

        return;
    }
  }

  private getCurrentDateInTimeZone(timeZone: string, now = new Date()): string {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

    const year = parts.find((part) => part.type === 'year')?.value;

    const month = parts.find((part) => part.type === 'month')?.value;

    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) {
      throw new Error('Could not determine the current date');
    }

    return `${year}-${month}-${day}`;
  }
}
