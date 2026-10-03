import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Brackets, DataSource, EntityManager } from 'typeorm';
import {
  changeScheduleInstant,
  DEFAULT_TIME_ZONE,
  getCurrentDateInTimeZone,
} from '../../common/date/date-only.utils';
import {
  HabitOccurrenceCancellationReason,
  HabitOccurrenceEntity,
} from '../../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitScheduleCalculator } from '../../habit-occurrences/scheduling/habit-schedule-calculator';
import { ChangeHabitScheduleDto } from '../dto/change-habit-schedule.dto';
import {
  HabitResponseDto,
  ScheduleVersionResponse,
} from '../dto/habit-response.dto';
import { HabitEntity } from '../entities/habit.entity';
import { HabitScheduleVersionEntity } from '../entities/habit-schedule-version.entity';
import { HabitScheduleType } from '../enums/habit-schedule-type.enum';
import {
  buildVersion,
  expiresAt,
  nextScheduledDate,
  normalizeSchedule,
  ruleResponse,
  sameSchedule,
  slotStartsAt,
} from './schedule-rules';

@Injectable()
export class HabitSchedulingService {
  constructor(private readonly dataSource: DataSource) {}

  async lockHabit(
    userId: string,
    manager: EntityManager,
    habitId: number,
  ): Promise<HabitEntity> {
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

  private activeVersion(
    versions: HabitScheduleVersionEntity[],
    at: Date,
  ): HabitScheduleVersionEntity | undefined {
    const matching = versions.filter(
      (version) =>
        version.cancelledAt === null &&
        version.effectiveAt <= at &&
        (version.endsAt === null || at < version.endsAt),
    );

    if (matching.length > 1) {
      throw new ConflictException('Overlapping schedule versions');
    }

    return matching[0];
  }

  versionResponse(
    version: HabitScheduleVersionEntity,
  ): ScheduleVersionResponse {
    return {
      id: version.id,
      effectiveFrom: getCurrentDateInTimeZone(
        DEFAULT_TIME_ZONE,
        version.effectiveAt,
      ),
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
    at = new Date(),
  ): HabitResponseDto {
    const active = this.activeVersion(versions, at);

    const upcoming = versions.find(
      (version) => version.cancelledAt === null && version.effectiveAt > at,
    );

    return {
      id: habit.id,
      title: habit.title,
      isActive: habit.isActive,
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

    return this.dataSource.transaction(async (manager) => {
      const habit = await this.lockHabit(userId, manager, habitId);

      // Erst nach dem Lock bestimmen: parallele Änderungen erhalten
      // ihre tatsächliche Reihenfolge.
      const now = new Date();
      const effectiveAt = changeScheduleInstant(dto.effectiveFrom, now);

      await this.reconcile(manager, habit, now);

      const versions = await this.getVersions(manager, habitId);
      const active = this.activeVersion(versions, now);

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
    await this.dataSource.transaction(async (manager) => {
      const habit = await this.lockHabit(userId, manager, habitId);

      await this.reconcile(manager, habit, at ?? new Date());
    });
  }

  async reconcile(
    manager: EntityManager,
    habit: HabitEntity,
    now: Date,
  ): Promise<void> {
    const today = getCurrentDateInTimeZone(DEFAULT_TIME_ZONE, now);
    const versions = await this.getVersions(manager, habit.id);

    const usable = versions.filter((version) => version.cancelledAt === null);

    for (let index = 1; index < usable.length; index += 1) {
      const previous = usable[index - 1];
      const current = usable[index];

      if (
        previous &&
        current &&
        (previous.endsAt === null || previous.endsAt > current.effectiveAt)
      ) {
        throw new ConflictException('Overlapping schedule versions');
      }
    }

    const repository = manager.getRepository(HabitOccurrenceEntity);

    const occurrences = await repository.find({
      where: { habitId: habit.id },
      order: { scheduledDate: 'ASC', id: 'ASC' },
    });

    const versionById = new Map(
      versions.map((version) => [version.id, version]),
    );

    for (const occurrence of occurrences) {
      const version = versionById.get(occurrence.scheduleVersionId);

      if (!version) {
        throw new ConflictException(
          `Occurrence ${occurrence.id} has an invalid version`,
        );
      }

      if (occurrence.status !== HabitOccurrenceStatus.PENDING) {
        continue;
      }

      const expiry = expiresAt(version, occurrence.scheduledDate);

      const closed = version.endsAt !== null && version.endsAt <= now;

      if (closed && version.endsAt !== null) {
        if (expiry <= version.endsAt) {
          await this.resolve(
            manager,
            occurrence,
            HabitOccurrenceStatus.SKIPPED,
            today,
          );
        } else {
          await this.resolve(
            manager,
            occurrence,
            HabitOccurrenceStatus.CANCELLED,
            getCurrentDateInTimeZone(DEFAULT_TIME_ZONE, version.endsAt),
            'schedule_changed',
          );
        }
      } else if (habit.isActive && expiry <= now) {
        await this.resolve(
          manager,
          occurrence,
          HabitOccurrenceStatus.SKIPPED,
          today,
        );
      }
    }

    if (!habit.isActive) {
      return;
    }

    for (const version of usable) {
      if (
        version.effectiveAt > now ||
        version.type === HabitScheduleType.WEEKLY_TARGET
      ) {
        continue;
      }

      const closed = version.endsAt !== null && version.endsAt <= now;

      let candidate = nextScheduledDate(version, null);
      let examined = 0;

      while (
        candidate <= today &&
        (version.endsAt === null ||
          slotStartsAt(version, candidate) < version.endsAt)
      ) {
        examined += 1;

        if (examined > 10000) {
          throw new ConflictException(
            'Too many historical slots for one generation run',
          );
        }

        const existing = occurrences.find(
          (item) =>
            item.scheduleVersionId === version.id &&
            item.scheduledDate === candidate,
        );

        if (!existing) {
          const expiry = expiresAt(version, candidate);

          let status: HabitOccurrenceStatus;
          let resolvedDate: string | null;
          let reason: HabitOccurrenceCancellationReason | null = null;

          if (closed && version.endsAt !== null) {
            if (expiry <= version.endsAt) {
              status = HabitOccurrenceStatus.SKIPPED;
              resolvedDate = today;
            } else {
              status = HabitOccurrenceStatus.CANCELLED;
              resolvedDate = getCurrentDateInTimeZone(
                DEFAULT_TIME_ZONE,
                version.endsAt,
              );
              reason = 'schedule_changed';
            }
          } else if (expiry <= now) {
            status = HabitOccurrenceStatus.SKIPPED;
            resolvedDate = today;
          } else if (
            occurrences.some(
              (item) =>
                item.status === HabitOccurrenceStatus.COMPLETED &&
                item.resolvedDate === today,
            )
          ) {
            status = HabitOccurrenceStatus.CANCELLED;
            resolvedDate = today;
            reason = 'already_completed_today';
          } else {
            status = HabitOccurrenceStatus.PENDING;
            resolvedDate = null;
          }

          const saved = await repository.save(
            repository.create({
              habitId: habit.id,
              scheduleVersionId: version.id,
              scheduledDate: candidate,
              status,
              resolvedDate,
              cancellationReason: reason,
            }),
          );

          occurrences.push(saved);
        }

        candidate = nextScheduledDate(version, candidate);
      }
    }

    const active = this.activeVersion(versions, now);

    if (!active || active.type !== HabitScheduleType.WEEKLY_TARGET) {
      return;
    }

    const week = HabitScheduleCalculator.getWeekRange(today);

    const completedThisWeek = occurrences.filter(
      (item) =>
        item.status === HabitOccurrenceStatus.COMPLETED &&
        item.resolvedDate !== null &&
        week.startDate <= item.resolvedDate &&
        item.resolvedDate <= today,
    ).length;

    const pending = occurrences.find(
      (item) => item.status === HabitOccurrenceStatus.PENDING,
    );

    if (
      active.weeklyTarget !== null &&
      completedThisWeek >= active.weeklyTarget
    ) {
      if (pending) {
        await this.resolve(
          manager,
          pending,
          HabitOccurrenceStatus.CANCELLED,
          today,
          'weekly_target_reached',
        );
      }

      return;
    }

    const completedToday = occurrences.some(
      (item) =>
        item.status === HabitOccurrenceStatus.COMPLETED &&
        item.resolvedDate === today,
    );

    const existingToday = occurrences.some(
      (item) =>
        item.scheduleVersionId === active.id && item.scheduledDate === today,
    );

    if (pending || completedToday || existingToday) {
      return;
    }

    await repository.save(
      repository.create({
        habitId: habit.id,
        scheduleVersionId: active.id,
        scheduledDate: today,
        status: HabitOccurrenceStatus.PENDING,
        resolvedDate: null,
        cancellationReason: null,
      }),
    );
  }

  private async resolve(
    manager: EntityManager,
    occurrence: HabitOccurrenceEntity,
    status: HabitOccurrenceStatus,
    resolvedDate: string,
    reason: HabitOccurrenceCancellationReason | null = null,
  ): Promise<void> {
    occurrence.status = status;
    occurrence.resolvedDate = resolvedDate;
    occurrence.cancellationReason = reason;

    await manager.getRepository(HabitOccurrenceEntity).save(occurrence);
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

    const initial = await this.dataSource
      .getRepository(HabitOccurrenceEntity)
      .createQueryBuilder('occurrence')
      .innerJoin('occurrence.habit', 'habit')
      .where('occurrence.id = :id', { id })
      .andWhere('"habit"."userId" = :userId', { userId })
      .andWhere('"habit"."deletedAt" IS NULL')
      .getOne();

    if (!initial) {
      throw new NotFoundException(
        `Habit occurrence with ID ${id} was not found`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const habit = await this.lockHabit(userId, manager, initial.habitId);
      const now = new Date();
      const today = getCurrentDateInTimeZone(DEFAULT_TIME_ZONE, now);

      await this.reconcile(manager, habit, now);

      const repository = manager.getRepository(HabitOccurrenceEntity);
      const occurrence = await repository.findOneByOrFail({ id });

      if (occurrence.status === targetStatus) {
        return occurrence;
      }

      if (occurrence.status === HabitOccurrenceStatus.CANCELLED) {
        throw new ConflictException('Cancelled occurrences cannot be changed');
      }

      const active = this.activeVersion(
        await this.getVersions(manager, habit.id),
        now,
      );

      if (
        !habit.isActive ||
        !active ||
        occurrence.scheduleVersionId !== active.id ||
        occurrence.scheduledDate > today ||
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
                (item.status === HabitOccurrenceStatus.COMPLETED &&
                  item.resolvedDate === today)),
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
      occurrence.cancellationReason = null;

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

  async getToday(userId: string): Promise<HabitOccurrenceEntity[]> {
    const habits = await this.dataSource.getRepository(HabitEntity).find({
      where: { isActive: true, userId },
      order: { id: 'ASC' },
    });

    for (const habit of habits) {
      await this.generateForHabit(userId, habit.id);
    }

    const today = getCurrentDateInTimeZone();

    return this.dataSource
      .getRepository(HabitOccurrenceEntity)
      .createQueryBuilder('occurrence')
      .innerJoinAndSelect('occurrence.habit', 'habit')
      .innerJoinAndSelect('occurrence.scheduleVersion', 'version')
      .where('"habit"."isActive" = true')
      .andWhere('"habit"."userId" = :userId', { userId })
      .andWhere('"habit"."deletedAt" IS NULL')
      .andWhere(
        new Brackets((query) => {
          query
            .where(
              `"occurrence"."status" = :pending
               AND "occurrence"."scheduledDate" <= :today`,
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
