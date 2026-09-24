import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HabitEntity } from '../habits/entities/habit.entity';
import { HabitOccurrenceEntity } from './entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from './enums/habit-occurrence-status.enum';
import { getCurrentDateInTimeZone } from '../common/date/date-only.utils';

@Injectable()
export class HabitOccurrencesService {
  constructor(
    @InjectRepository(HabitOccurrenceEntity)
    private readonly occurrenceRepository: Repository<HabitOccurrenceEntity>,

    @InjectRepository(HabitEntity)
    private readonly habitRepository: Repository<HabitEntity>,
  ) {}

  async createPendingOccurrence(
    habitId: number,
    scheduledDate: string,
  ): Promise<HabitOccurrenceEntity> {
    const habit = await this.habitRepository.findOneBy({
      id: habitId,
    });

    if (!habit) {
      throw new NotFoundException(`Habit with ID ${habitId} was not found`);
    }

    if (!habit.isActive) {
      throw new BadRequestException(
        'An inactive habit cannot receive new occurrences',
      );
    }

    const existingOccurrence = await this.occurrenceRepository.findOneBy({
      habitId,
      scheduledDate,
    });

    if (existingOccurrence) {
      return existingOccurrence;
    }

    const occurrence = this.occurrenceRepository.create({
      habitId,
      scheduledDate,
      status: HabitOccurrenceStatus.PENDING,
      resolvedDate: null,
    });

    return this.occurrenceRepository.save(occurrence);
  }

  async findByHabit(habitId: number): Promise<HabitOccurrenceEntity[]> {
    const habit = await this.habitRepository.findOneBy({
      id: habitId,
    });

    if (!habit) {
      throw new NotFoundException(`Habit with ID ${habitId} was not found`);
    }

    return this.occurrenceRepository.find({
      where: {
        habitId,
      },
      order: {
        scheduledDate: 'ASC',
        id: 'ASC',
      },
    });
  }

  async findOne(id: number): Promise<HabitOccurrenceEntity> {
    const occurrence = await this.occurrenceRepository.findOneBy({
      id,
    });

    if (!occurrence) {
      throw new NotFoundException(
        `Habit occurrence with ID ${id} was not found`,
      );
    }

    return occurrence;
  }

  async updateStatus(
    id: number,
    targetStatus: HabitOccurrenceStatus,
  ): Promise<HabitOccurrenceEntity> {
    const occurrence = await this.findOne(id);

    if (occurrence.status === targetStatus) {
      return occurrence;
    }

    if (!this.isStatusTransitionAllowed(occurrence.status, targetStatus)) {
      throw new ConflictException(
        `Cannot change occurrence status from ${occurrence.status} to ${targetStatus}`,
      );
    }

    occurrence.status = targetStatus;

    occurrence.resolvedDate =
      targetStatus === HabitOccurrenceStatus.PENDING
        ? null
        : getCurrentDateInTimeZone();

    return this.occurrenceRepository.save(occurrence);
  }

  private isStatusTransitionAllowed(
    currentStatus: HabitOccurrenceStatus,
    targetStatus: HabitOccurrenceStatus,
  ): boolean {
    if (currentStatus === HabitOccurrenceStatus.PENDING) {
      return (
        targetStatus === HabitOccurrenceStatus.COMPLETED ||
        targetStatus === HabitOccurrenceStatus.SKIPPED
      );
    }

    return targetStatus === HabitOccurrenceStatus.PENDING;
  }
}
