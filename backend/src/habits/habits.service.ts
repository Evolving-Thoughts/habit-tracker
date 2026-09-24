import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { CreateHabitDto } from './dto/create-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import { HabitEntity } from './entities/habit.entity';
import { HabitScheduleType } from './enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from './enums/missed-occurrence-policy.enum';
import { Weekday } from './enums/weekday.enum';
import { getCurrentDateInTimeZone } from '../common/date/date-only.utils';

type HabitSchedule = {
  scheduleType: HabitScheduleType;
  intervalDays: number | null;
  weekdays: Weekday[] | null;
  weeklyTarget: number | null;
};

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

  async findOne(id: number): Promise<HabitEntity> {
    const habit = await this.habitRepository.findOneBy({
      id,
    });

    if (!habit) {
      throw new NotFoundException(`Habit with ID ${id} was not found`);
    }

    return habit;
  }

  async create(createHabitDto: CreateHabitDto): Promise<HabitEntity> {
    const startDate = createHabitDto.startDate ?? getCurrentDateInTimeZone();

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

  async update(
    id: number,
    updateHabitDto: UpdateHabitDto,
  ): Promise<HabitEntity> {
    const hasChanges = Object.values(updateHabitDto).some(
      (value) => value !== undefined,
    );

    if (!hasChanges) {
      throw new BadRequestException('At least one property must be provided');
    }

    const changes: DeepPartial<HabitEntity> = {
      id,
    };

    if (updateHabitDto.title !== undefined) {
      changes.title = updateHabitDto.title;
    }

    if (updateHabitDto.scheduleType !== undefined) {
      changes.scheduleType = updateHabitDto.scheduleType;
    }

    if (updateHabitDto.startDate !== undefined) {
      changes.startDate = updateHabitDto.startDate;
    }

    if (updateHabitDto.intervalDays !== undefined) {
      changes.intervalDays = updateHabitDto.intervalDays;
    }

    if (updateHabitDto.weekdays !== undefined) {
      changes.weekdays = updateHabitDto.weekdays;
    }

    if (updateHabitDto.weeklyTarget !== undefined) {
      changes.weeklyTarget = updateHabitDto.weeklyTarget;
    }

    if (updateHabitDto.missedOccurrencePolicy !== undefined) {
      changes.missedOccurrencePolicy = updateHabitDto.missedOccurrencePolicy;
    }

    if (updateHabitDto.isActive !== undefined) {
      changes.isActive = updateHabitDto.isActive;
    }

    const habit = await this.habitRepository.preload(changes);

    if (!habit) {
      throw new NotFoundException(`Habit with ID ${id} was not found`);
    }

    this.validateSchedule({
      scheduleType: habit.scheduleType,
      intervalDays: habit.intervalDays,
      weekdays: habit.weekdays,
      weeklyTarget: habit.weeklyTarget,
    });

    return this.habitRepository.save(habit);
  }

  async remove(id: number): Promise<void> {
    const habit = await this.findOne(id);

    await this.habitRepository.softRemove(habit);
  }

  private validateSchedule(schedule: HabitSchedule): void {
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
}
