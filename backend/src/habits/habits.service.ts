import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, Repository } from 'typeorm';
import { getCurrentDateInTimeZone } from '../common/date/date-only.utils';
import { CreateHabitDto } from './dto/create-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import { HabitEntity } from './entities/habit.entity';
import { HabitScheduleVersionEntity } from './entities/habit-schedule-version.entity';
import { HabitScheduleType } from './enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from './enums/missed-occurrence-policy.enum';
import { Weekday } from './enums/weekday.enum';
import { createInitialScheduleVersion } from './scheduling/create-initial-schedule-version';

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

    private readonly dataSource: DataSource,
  ) {}

  findAll(): Promise<HabitEntity[]> {
    return this.habitRepository.find({
      order: {
        id: 'ASC',
      },
    });
  }

  async findOne(id: number): Promise<HabitEntity> {
    const habit = await this.habitRepository.findOneBy({ id });

    if (!habit) {
      throw new NotFoundException(`Habit with ID ${id} was not found`);
    }

    return habit;
  }

  async create(dto: CreateHabitDto): Promise<HabitEntity> {
    const startDate = dto.startDate ?? getCurrentDateInTimeZone();
    const intervalDays = dto.intervalDays ?? null;
    const weekdays = dto.weekdays ?? null;
    const weeklyTarget = dto.weeklyTarget ?? null;

    this.validateSchedule({
      scheduleType: dto.scheduleType,
      intervalDays,
      weekdays,
      weeklyTarget,
    });

    return this.dataSource.transaction(async (manager) => {
      const habitRepository = manager.getRepository(HabitEntity);

      const versionRepository = manager.getRepository(
        HabitScheduleVersionEntity,
      );

      const habit = habitRepository.create({
        title: dto.title,
        scheduleType: dto.scheduleType,
        startDate,
        intervalDays,
        weekdays,
        weeklyTarget,
        missedOccurrencePolicy:
          dto.missedOccurrencePolicy ?? MissedOccurrencePolicy.CARRY_OVER,
        isActive: true,
      });

      const savedHabit = await habitRepository.save(habit);

      const initialVersion = createInitialScheduleVersion(savedHabit);

      await versionRepository.save(initialVersion);

      return savedHabit;
    });
  }

  async update(id: number, dto: UpdateHabitDto): Promise<HabitEntity> {
    const hasChanges = Object.values(dto).some((value) => value !== undefined);

    if (!hasChanges) {
      throw new BadRequestException('At least one property must be provided');
    }

    const changes: DeepPartial<HabitEntity> = { id };

    if (dto.title !== undefined) {
      changes.title = dto.title;
    }

    if (dto.scheduleType !== undefined) {
      changes.scheduleType = dto.scheduleType;
    }

    if (dto.startDate !== undefined) {
      changes.startDate = dto.startDate;
    }

    if (dto.intervalDays !== undefined) {
      changes.intervalDays = dto.intervalDays;
    }

    if (dto.weekdays !== undefined) {
      changes.weekdays = dto.weekdays;
    }

    if (dto.weeklyTarget !== undefined) {
      changes.weeklyTarget = dto.weeklyTarget;
    }

    if (dto.missedOccurrencePolicy !== undefined) {
      changes.missedOccurrencePolicy = dto.missedOccurrencePolicy;
    }

    if (dto.isActive !== undefined) {
      changes.isActive = dto.isActive;
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
