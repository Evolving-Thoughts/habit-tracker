import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Brackets, DataSource, EntityManager } from 'typeorm';
import {
  assertDateOnly,
  changeScheduleInstant,
} from '../../common/date/date-only.utils';
import { dayOf } from '../../common/date/local-day';
import { Clock } from '../../common/clock';
import { lockUser, UserUnitOfWork } from '../../common/user-unit-of-work';
import { ownedOccurrences } from '../../habit-occurrences/owned-occurrences';
import {
  effectiveDuration,
  hasOpenTimer,
  releaseTimers,
} from '../../timers/timer-target';
import {
  HabitOccurrenceEntity,
  occurrenceDueDate,
} from '../../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../../habit-occurrences/enums/habit-occurrence-status.enum';
import { ChangeHabitScheduleDto } from '../dto/change-habit-schedule.dto';
import {
  HabitResponseDto,
  ScheduleVersionResponse,
} from '../dto/habit-response.dto';
import { HabitEntity } from '../entities/habit.entity';
import { HabitScheduleVersionEntity } from '../entities/habit-schedule-version.entity';
import {
  buildVersion,
  expiresAt,
  isInMoveWindow,
  normalizeSchedule,
  ruleResponse,
  sameSchedule,
} from './schedule-rules';
import {
  activeVersion,
  isCompletedOn,
  lifecycleChanges,
} from './occurrence-lifecycle';

@Injectable()
export class HabitSchedulingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  /** Locks the owner first, then the habit (same order as timers and todos). */
  async lockHabit(
    userId: string,
    manager: EntityManager,
    habitId: number,
  ): Promise<HabitEntity> {
    await lockUser(manager, userId);
    const habit = await manager.getRepository(HabitEntity).findOne({
      where: { id: habitId, userId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!habit) {
      throw new NotFoundException(`Habit with ID ${habitId} was not found`);
    }

    return habit;
  }

  getVersions(
    manager: EntityManager,
    habitId: number,
  ): Promise<HabitScheduleVersionEntity[]> {
    return manager.getRepository(HabitScheduleVersionEntity).find({
      where: { habitId },
      order: { effectiveAt: 'ASC', id: 'ASC' },
    });
  }

  versionResponse(
    version: HabitScheduleVersionEntity,
  ): ScheduleVersionResponse {
    return {
      id: version.id,
      effectiveFrom: dayOf(version.effectiveAt),
      effectiveAt: version.effectiveAt.toISOString(),
      endsAt: version.endsAt?.toISOString() ?? null,
      cancelledAt: version.cancelledAt?.toISOString() ?? null,
      firstDueDate: version.firstDueDate,
      schedule: ruleResponse(version),
    };
  }

  habitResponse(
    habit: HabitEntity,
    versions: HabitScheduleVersionEntity[],
    at = this.clock.now(),
    pending?: HabitOccurrenceEntity,
  ): HabitResponseDto {
    const active = activeVersion(versions, at);

    const upcoming = versions.find(
      (version) => version.cancelledAt === null && version.effectiveAt > at,
    );

    return {
      id: habit.id,
      title: habit.title,
      categoryId: habit.categoryId ?? null,
      why: habit.why ?? null,
      isActive: habit.isActive,
      plannedDurationMinutes: habit.plannedDurationMinutes,
      timeOfDay: habit.timeOfDay ?? null,
      timerOccurrenceId: pending?.id ?? null,
      timerDurationMinutes: pending ? effectiveDuration(pending, habit) : null,
      currentSchedule: active ? this.versionResponse(active) : null,
      upcomingSchedule: upcoming ? this.versionResponse(upcoming) : null,
    };
  }

  async changeSchedule(
    userId: string,
    habitId: number,
    dto: ChangeHabitScheduleDto,
  ): Promise<HabitResponseDto> {
    const definition = normalizeSchedule(dto.schedule);

    return this.unitOfWork.run(userId, async (manager) => {
      const habit = await this.lockHabit(userId, manager, habitId);

      // Erst nach dem Lock bestimmen: parallele Änderungen erhalten
      // ihre tatsächliche Reihenfolge.
      const now = this.clock.now();
      const effectiveAt = changeScheduleInstant(dto.effectiveFrom, now);

      await this.reconcile(manager, habit, now);

      const versions = await this.getVersions(manager, habitId);
      const active = activeVersion(versions, now);

      const upcoming = versions.filter(
        (version) => version.cancelledAt === null && version.effectiveAt > now,
      );

      const identicalUpcoming = upcoming.find(
        (version) =>
          version.effectiveAt.getTime() === effectiveAt.getTime() &&
          sameSchedule(version, definition),
      );

      if (identicalUpcoming) {
        return this.habitResponse(habit, versions, now);
      }

      const repository = manager.getRepository(HabitScheduleVersionEntity);

      for (const version of upcoming) {
        version.cancelledAt = now;
        await repository.save(version);
      }

      const immediate = effectiveAt.getTime() === now.getTime();

      if (immediate && active && sameSchedule(active, definition)) {
        // Dieselbe aktuelle Regel: eine vorhandene Vormerkung
        // wird entfernt, ohne eine unnötige Version anzulegen.
        active.endsAt = null;
        await repository.save(active);
      } else {
        if (active) {
          active.endsAt = effectiveAt;
          await repository.save(active);
        }

        await repository.save(buildVersion(habitId, definition, effectiveAt));
      }

      await this.reconcile(manager, habit, now);

      return this.habitResponse(
        habit,
        await this.getVersions(manager, habitId),
        now,
      );
    });
  }

  async generateForHabit(
    userId: string,
    habitId: number,
    at?: Date,
  ): Promise<void> {
    await this.unitOfWork.run(userId, async (manager) => {
      const habit = await this.lockHabit(userId, manager, habitId);

      await this.reconcile(manager, habit, at ?? this.clock.now());
    });
  }

  async reconcile(
    manager: EntityManager,
    habit: HabitEntity,
    now: Date,
  ): Promise<void> {
    const repository = manager.getRepository(HabitOccurrenceEntity);
    const occurrences = await repository.find({
      where: { habitId: habit.id },
      order: { scheduledDate: 'ASC', id: 'ASC' },
    });
    const { resolve, create } = lifecycleChanges(
      habit,
      await this.getVersions(manager, habit.id),
      occurrences,
      now,
    );

    for (const { occurrence, resolution } of resolve) {
      await repository.save(Object.assign(occurrence, resolution));
      // A resolved occurrence is no timer target any more.
      await releaseTimers(
        manager,
        habit.userId,
        { occurrenceIds: [occurrence.id] },
        now,
      );
    }
    for (const occurrence of create)
      await repository.save(
        repository.create({ habitId: habit.id, ...occurrence }),
      );
  }

  async changeStatus(
    userId: string,
    id: number,
    targetStatus: HabitOccurrenceStatus,
  ): Promise<HabitOccurrenceEntity> {
    if (
      ![
        HabitOccurrenceStatus.PENDING,
        HabitOccurrenceStatus.COMPLETED,
        HabitOccurrenceStatus.SKIPPED,
      ].includes(targetStatus)
    ) {
      throw new BadRequestException('Invalid manual status');
    }

    const initial = await ownedOccurrences(this.dataSource.manager, userId)
      .andWhere('occurrence.id = :id', { id })
      .getOne();

    if (!initial) {
      throw new NotFoundException(
        `Habit occurrence with ID ${id} was not found`,
      );
    }

    return this.unitOfWork.run(userId, async (manager) => {
      const habit = await this.lockHabit(userId, manager, initial.habitId);
      const now = this.clock.now();
      const today = dayOf(now);

      await this.reconcile(manager, habit, now);

      const repository = manager.getRepository(HabitOccurrenceEntity);
      const occurrence = await repository.findOneByOrFail({ id });

      if (occurrence.status === targetStatus) {
        return occurrence;
      }

      if (occurrence.status === HabitOccurrenceStatus.CANCELLED) {
        throw new ConflictException('Cancelled occurrences cannot be changed');
      }

      const active = activeVersion(
        await this.getVersions(manager, habit.id),
        now,
      );

      if (
        !habit.isActive ||
        !active ||
        occurrence.scheduleVersionId !== active.id ||
        occurrenceDueDate(occurrence) > today ||
        expiresAt(active, occurrence.scheduledDate) <= now
      ) {
        throw new ConflictException('This occurrence is no longer actionable');
      }

      if (
        occurrence.status !== HabitOccurrenceStatus.PENDING &&
        targetStatus !== HabitOccurrenceStatus.PENDING
      ) {
        throw new ConflictException(
          'Reopen an occurrence before changing its resolved status',
        );
      }

      if (targetStatus === HabitOccurrenceStatus.PENDING) {
        const others = await repository.find({
          where: { habitId: habit.id },
        });

        if (
          others.some(
            (item) =>
              item.id !== occurrence.id &&
              (item.status === HabitOccurrenceStatus.PENDING ||
                isCompletedOn(item, today)),
          )
        ) {
          throw new ConflictException(
            'Another pending or completed-today occurrence exists',
          );
        }
      }

      occurrence.status = targetStatus;
      occurrence.resolvedDate =
        targetStatus === HabitOccurrenceStatus.PENDING ? null : today;
      occurrence.resolvedAt =
        targetStatus === HabitOccurrenceStatus.COMPLETED ? now : null;
      occurrence.cancellationReason = null;

      const saved = await repository.save(occurrence);
      if (targetStatus !== HabitOccurrenceStatus.PENDING)
        await releaseTimers(manager, userId, { occurrenceIds: [id] }, now);
      return saved;
    });
  }

  /**
   * Moves a pending occurrence within its window. Only `movedToDate` changes:
   * the slot and with it the fixed schedule grid stay as they are.
   */
  async reschedule(
    userId: string,
    id: number,
    date: string,
  ): Promise<HabitOccurrenceEntity> {
    assertDateOnly(date);

    const initial = await ownedOccurrences(this.dataSource.manager, userId)
      .andWhere('occurrence.id = :id', { id })
      .getOne();

    if (!initial) {
      throw new NotFoundException(
        `Habit occurrence with ID ${id} was not found`,
      );
    }

    return this.unitOfWork.run(userId, async (manager) => {
      const habit = await this.lockHabit(userId, manager, initial.habitId);
      const now = this.clock.now();
      const today = dayOf(now);

      await this.reconcile(manager, habit, now);

      const repository = manager.getRepository(HabitOccurrenceEntity);
      const occurrence = await repository.findOneByOrFail({ id });
      const active = activeVersion(
        await this.getVersions(manager, habit.id),
        now,
      );

      if (
        !habit.isActive ||
        !active ||
        occurrence.status !== HabitOccurrenceStatus.PENDING ||
        occurrence.scheduleVersionId !== active.id
      ) {
        throw new ConflictException(
          'Diese Ausführung kann nicht mehr verschoben werden.',
        );
      }

      if (!isInMoveWindow(active, occurrence.scheduledDate, date, today)) {
        throw new ConflictException(
          'Der Tag liegt außerhalb des Terminfensters.',
        );
      }

      if (await hasOpenTimer(manager, userId, { occurrenceId: id })) {
        throw new ConflictException(
          'Beende zuerst den Timer, bevor du das Habit verschiebst.',
        );
      }

      occurrence.movedToDate = date === occurrence.scheduledDate ? null : date;

      return repository.save(occurrence);
    });
  }

  async history(
    userId: string,
    habitId: number,
  ): Promise<HabitOccurrenceEntity[]> {
    const habit = await this.dataSource
      .getRepository(HabitEntity)
      .findOneBy({ id: habitId, userId });

    if (!habit) {
      throw new NotFoundException(`Habit with ID ${habitId} was not found`);
    }

    return this.dataSource.getRepository(HabitOccurrenceEntity).find({
      where: { habitId },
      order: { scheduledDate: 'ASC', id: 'ASC' },
    });
  }

  /** Reconciles every active habit of the user in one locked transaction, then reads today's occurrences. */
  async getToday(userId: string): Promise<HabitOccurrenceEntity[]> {
    return this.unitOfWork.run(userId, (manager) =>
      this.todayIn(manager, userId),
    );
  }

  private async todayIn(
    manager: EntityManager,
    userId: string,
  ): Promise<HabitOccurrenceEntity[]> {
    const now = this.clock.now();
    const habits = await manager.getRepository(HabitEntity).find({
      where: { isActive: true, userId },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });

    for (const habit of habits) {
      await this.reconcile(manager, habit, now);
    }

    const today = dayOf(now);

    return ownedOccurrences(manager, userId, { select: true })
      .innerJoinAndSelect('occurrence.scheduleVersion', 'version')
      .andWhere('"habit"."isActive" = true')
      .andWhere(
        new Brackets((query) => {
          query
            .where(
              `"occurrence"."status" = :pending
               AND COALESCE("occurrence"."movedToDate", "occurrence"."scheduledDate") <= :today`,
              {
                pending: HabitOccurrenceStatus.PENDING,
                today,
              },
            )
            .orWhere(
              `"occurrence"."status" = :completed
               AND "occurrence"."resolvedDate" = :today`,
              {
                completed: HabitOccurrenceStatus.COMPLETED,
                today,
              },
            )
            .orWhere(
              `"occurrence"."status" = :skipped
               AND "occurrence"."scheduledDate" = :today
               AND "occurrence"."resolvedDate" = :today`,
              {
                skipped: HabitOccurrenceStatus.SKIPPED,
                today,
              },
            );
        }),
      )
      .orderBy('"occurrence"."scheduledDate"', 'ASC')
      .addOrderBy('"occurrence"."id"', 'ASC')
      .getMany();
  }
}
