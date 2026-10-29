import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, LessThanOrEqual } from 'typeorm';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { initialScheduleInstant } from '../common/date/date-only.utils';
import { dayOf } from '../common/date/local-day';
import { Clock } from '../common/clock';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { releaseTimers } from '../timers/timer-target';
import { CreateHabitDto } from './dto/create-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import { ChangeHabitScheduleDto } from './dto/change-habit-schedule.dto';
import {
  HabitResponseDto,
  ScheduleVersionResponse,
} from './dto/habit-response.dto';
import { HabitEntity } from './entities/habit.entity';
import { HabitScheduleVersionEntity } from './entities/habit-schedule-version.entity';
import { HabitSchedulingService } from './scheduling/habit-scheduling.service';
import { buildVersion, normalizeSchedule } from './scheduling/schedule-rules';

@Injectable()
export class HabitsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly scheduling: HabitSchedulingService,
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  private validTitle(title: string): string {
    const trimmed = title.trim();

    if (trimmed.length === 0 || trimmed.length > 200) {
      throw new BadRequestException('Invalid habit title');
    }

    return trimmed;
  }

  async findAll(userId: string): Promise<HabitResponseDto[]> {
    const due = await this.scheduling.getToday(userId);
    const habits = await this.dataSource.getRepository(HabitEntity).find({
      where: { userId },
      order: { id: 'ASC' },
    });

    // One query for all schedule versions instead of one per habit.
    const versions = habits.length
      ? await this.dataSource.getRepository(HabitScheduleVersionEntity).find({
          where: { habitId: In(habits.map((habit) => habit.id)) },
          order: { effectiveAt: 'ASC', id: 'ASC' },
        })
      : [];
    const now = this.clock.now();
    const result: HabitResponseDto[] = [];

    for (const habit of habits) {
      result.push(
        this.scheduling.habitResponse(
          habit,
          versions.filter((version) => version.habitId === habit.id),
          now,
          due.find(
            (item) =>
              item.habitId === habit.id &&
              item.status === HabitOccurrenceStatus.PENDING,
          ),
        ),
      );
    }

    return result;
  }

  async findOne(userId: string, id: number): Promise<HabitResponseDto> {
    // Reconcile and read one owned Habit under the same Habit lock and reference time.
    // Opening its editor must not generate occurrences for every other Habit.
    return this.unitOfWork.run(userId, async (manager) => {
      const habit = await this.scheduling.lockHabit(userId, manager, id);
      const now = this.clock.now();
      await this.scheduling.reconcile(manager, habit, now);

      const pending = habit.isActive
        ? await manager.getRepository(HabitOccurrenceEntity).findOneBy({
            habitId: id,
            status: HabitOccurrenceStatus.PENDING,
            scheduledDate: LessThanOrEqual(dayOf(now)),
          })
        : null;

      return this.scheduling.habitResponse(
        habit,
        await this.scheduling.getVersions(manager, id),
        now,
        pending ?? undefined,
      );
    });
  }

  async findVersions(
    userId: string,
    id: number,
  ): Promise<ScheduleVersionResponse[]> {
    // History needs ownership validation, not occurrence generation or a write lock.
    const habit = await this.dataSource
      .getRepository(HabitEntity)
      .findOneBy({ id, userId });
    if (!habit)
      throw new NotFoundException(`Habit with ID ${id} was not found`);

    const versions = await this.scheduling.getVersions(
      this.dataSource.manager,
      id,
    );

    return versions.map((version) => this.scheduling.versionResponse(version));
  }

  async create(userId: string, dto: CreateHabitDto): Promise<HabitResponseDto> {
    const title = this.validTitle(dto.title);
    const definition = normalizeSchedule(dto.schedule);

    return this.unitOfWork.run(userId, async (manager) => {
      const now = this.clock.now();

      const effectiveAt = initialScheduleInstant(
        dto.startDate ?? dayOf(now),
        now,
      );

      const repository = manager.getRepository(HabitEntity);

      const habit = await repository.save(
        repository.create({
          plannedDurationMinutes: dto.plannedDurationMinutes ?? null,
          userId,
          title,
          isActive: true,
        }),
      );

      const version = await manager
        .getRepository(HabitScheduleVersionEntity)
        .save(buildVersion(habit.id, definition, effectiveAt));

      return this.scheduling.habitResponse(habit, [version], now);
    });
  }

  async update(
    userId: string,
    id: number,
    dto: UpdateHabitDto,
  ): Promise<HabitResponseDto> {
    if (
      dto.title === undefined &&
      dto.isActive === undefined &&
      dto.plannedDurationMinutes === undefined
    ) {
      throw new BadRequestException('At least one property must be provided');
    }

    return this.unitOfWork.run(userId, async (manager) => {
      const habit = await this.scheduling.lockHabit(userId, manager, id);

      if (dto.plannedDurationMinutes !== undefined)
        habit.plannedDurationMinutes = dto.plannedDurationMinutes;
      if (dto.title !== undefined) {
        habit.title = this.validTitle(dto.title);
      }

      if (dto.isActive !== undefined) {
        habit.isActive = dto.isActive;
      }

      await manager.getRepository(HabitEntity).save(habit);
      if (!habit.isActive)
        await releaseTimers(manager, userId, { habitId: habit.id });

      const now = this.clock.now();

      await this.scheduling.reconcile(manager, habit, now);

      return this.scheduling.habitResponse(
        habit,
        await this.scheduling.getVersions(manager, id),
        now,
      );
    });
  }

  changeSchedule(
    userId: string,
    id: number,
    dto: ChangeHabitScheduleDto,
  ): Promise<HabitResponseDto> {
    return this.scheduling.changeSchedule(userId, id, dto);
  }

  async remove(userId: string, id: number): Promise<void> {
    await this.unitOfWork.run(userId, async (manager) => {
      const habit = await this.scheduling.lockHabit(userId, manager, id);

      await manager.getRepository(HabitEntity).softRemove(habit);
      await releaseTimers(manager, userId, { habitId: habit.id });
    });
  }
}
