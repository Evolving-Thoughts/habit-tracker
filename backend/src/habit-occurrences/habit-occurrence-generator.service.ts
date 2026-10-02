import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Brackets, LessThanOrEqual, Repository } from 'typeorm';
import { HabitEntity } from '../habits/entities/habit.entity';
import { HabitScheduleType } from '../habits/enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../habits/enums/missed-occurrence-policy.enum';
import { HabitOccurrenceEntity } from './entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from './enums/habit-occurrence-status.enum';
import { HabitOccurrencesService } from './habit-occurrences.service';
import { HabitScheduleCalculator } from './scheduling/habit-schedule-calculator';
import { getCurrentDateInTimeZone } from '../common/date/date-only.utils';
import { Weekday } from '../habits/enums/weekday.enum';

@Injectable()
export class HabitOccurrenceGeneratorService {
  constructor(
    @InjectRepository(HabitEntity)
    private readonly habitRepository: Repository<HabitEntity>,

    @InjectRepository(HabitOccurrenceEntity)
    private readonly occurrenceRepository: Repository<HabitOccurrenceEntity>,

    private readonly occurrenceService: HabitOccurrencesService,
  ) {}

  async generateToday(): Promise<HabitOccurrenceEntity[]> {
    const today = getCurrentDateInTimeZone();

    const habits = await this.habitRepository.find({
      where: {
        isActive: true,
        startDate: LessThanOrEqual(today),
      },
      order: {
        id: 'ASC',
      },
    });

    for (const habit of habits) {
      await this.generateForHabit(habit, today);
    }

    return this.findOccurrencesForToday(today);
  }

  private async generateForHabit(
    habit: HabitEntity,
    today: string,
  ): Promise<void> {
    switch (habit.scheduleType) {
      case HabitScheduleType.INTERVAL:
        await this.generateIntervalOccurrence(habit, today);
        return;

      case HabitScheduleType.FIXED_WEEKDAYS:
        await this.generateFixedWeekdayOccurrence(habit, today);
        return;

      case HabitScheduleType.WEEKLY_TARGET:
        await this.generateWeeklyTargetOccurrence(habit, today);
        return;
    }
  }

  private async generateIntervalOccurrence(
    habit: HabitEntity,
    today: string,
  ): Promise<void> {
    if (habit.intervalDays === null) {
      return;
    }

    const pendingOccurrence = await this.findOldestPendingOccurrence(habit.id);

    let lastScheduledDate: string | null = null;

    if (pendingOccurrence) {
      const shouldSkip = this.shouldSkipIntervalOccurrence(
        habit,
        pendingOccurrence,
        today,
      );

      if (!shouldSkip) {
        // Die Ausführung befindet sich noch innerhalb
        // ihres erlaubten Carry-over-Zeitraums.
        return;
      }

      const skippedOccurrence = await this.occurrenceService.updateStatus(
        pendingOccurrence.id,
        HabitOccurrenceStatus.SKIPPED,
      );

      lastScheduledDate = skippedOccurrence.scheduledDate;
    } else {
      const lastOccurrence = await this.occurrenceRepository.findOne({
        where: {
          habitId: habit.id,
        },
        order: {
          scheduledDate: 'DESC',
          id: 'DESC',
        },
      });

      lastScheduledDate = lastOccurrence?.scheduledDate ?? null;
    }

    let dueDate = HabitScheduleCalculator.getNextIntervalDate({
      startDate: habit.startDate,
      intervalDays: habit.intervalDays,
      lastScheduledDate,
    });

    while (HabitScheduleCalculator.isOnOrBefore(dueDate, today)) {
      const occurrence = await this.occurrenceService.createPendingOccurrence(
        habit.id,
        dueDate,
      );

      const shouldSkip = this.shouldSkipIntervalOccurrence(
        habit,
        occurrence,
        today,
      );

      if (!shouldSkip) {
        // Die aktuelle Ausführung ist heute fällig
        // oder befindet sich noch im Carry-over-Fenster.
        return;
      }

      const skippedOccurrence = await this.occurrenceService.updateStatus(
        occurrence.id,
        HabitOccurrenceStatus.SKIPPED,
      );

      dueDate = HabitScheduleCalculator.getNextIntervalDate({
        startDate: habit.startDate,
        intervalDays: habit.intervalDays,
        lastScheduledDate: skippedOccurrence.scheduledDate,
      });
    }
  }

  private shouldSkipIntervalOccurrence(
    habit: HabitEntity,
    occurrence: HabitOccurrenceEntity,
    today: string,
  ): boolean {
    if (habit.missedOccurrencePolicy === MissedOccurrencePolicy.SKIP) {
      // Bei SKIP ist die Ausführung ausschließlich
      // am geplanten Tag gültig.
      return occurrence.scheduledDate < today;
    }

    if (habit.intervalDays === null) {
      return false;
    }

    const nextDueDate = HabitScheduleCalculator.addDays(
      occurrence.scheduledDate,
      habit.intervalDays,
    );

    // Bei CARRY_OVER bleibt die Ausführung bis
    // unmittelbar vor dem nächsten regulären
    // Termin offen.
    return nextDueDate <= today;
  }

  private async generateFixedWeekdayOccurrence(
    habit: HabitEntity,
    today: string,
  ): Promise<void> {
    if (habit.weekdays === null || habit.weekdays.length === 0) {
      return;
    }

    const pendingOccurrence = await this.findOldestPendingOccurrence(habit.id);

    let candidateDate: string;

    if (pendingOccurrence) {
      const shouldSkip = this.shouldSkipFixedWeekdayOccurrence(
        habit,
        pendingOccurrence,
        today,
      );

      if (!shouldSkip) {
        // Die Ausführung befindet sich noch innerhalb
        // ihres Carry-over-Zeitraums.
        return;
      }

      const skippedOccurrence = await this.occurrenceService.updateStatus(
        pendingOccurrence.id,
        HabitOccurrenceStatus.SKIPPED,
      );

      candidateDate = HabitScheduleCalculator.addDays(
        skippedOccurrence.scheduledDate,
        1,
      );
    } else {
      const lastOccurrence = await this.occurrenceRepository.findOne({
        where: {
          habitId: habit.id,
        },
        order: {
          scheduledDate: 'DESC',
          id: 'DESC',
        },
      });

      candidateDate = lastOccurrence
        ? HabitScheduleCalculator.addDays(lastOccurrence.scheduledDate, 1)
        : habit.startDate;
    }

    while (HabitScheduleCalculator.isOnOrBefore(candidateDate, today)) {
      if (
        !HabitScheduleCalculator.isFixedWeekday(candidateDate, habit.weekdays)
      ) {
        candidateDate = HabitScheduleCalculator.addDays(candidateDate, 1);

        continue;
      }

      const occurrence = await this.occurrenceService.createPendingOccurrence(
        habit.id,
        candidateDate,
      );

      const shouldSkip = this.shouldSkipFixedWeekdayOccurrence(
        habit,
        occurrence,
        today,
      );

      if (!shouldSkip) {
        return;
      }

      const skippedOccurrence = await this.occurrenceService.updateStatus(
        occurrence.id,
        HabitOccurrenceStatus.SKIPPED,
      );

      candidateDate = HabitScheduleCalculator.addDays(
        skippedOccurrence.scheduledDate,
        1,
      );
    }
  }

  private shouldSkipFixedWeekdayOccurrence(
    habit: HabitEntity,
    occurrence: HabitOccurrenceEntity,
    today: string,
  ): boolean {
    if (habit.missedOccurrencePolicy === MissedOccurrencePolicy.SKIP) {
      // Bei SKIP verfällt die Ausführung direkt
      // nach ihrem geplanten Tag.
      return occurrence.scheduledDate < today;
    }

    if (habit.weekdays === null || habit.weekdays.length === 0) {
      return false;
    }

    const nextDueDate = this.findNextFixedWeekdayDate(
      occurrence.scheduledDate,
      habit.weekdays,
    );

    // Bei CARRY_OVER bleibt die Ausführung bis zum
    // nächsten konfigurierten Wochentag offen.
    return nextDueDate <= today;
  }

  private findNextFixedWeekdayDate(
    afterDate: string,
    weekdays: Weekday[],
  ): string {
    let candidateDate = HabitScheduleCalculator.addDays(afterDate, 1);

    while (!HabitScheduleCalculator.isFixedWeekday(candidateDate, weekdays)) {
      candidateDate = HabitScheduleCalculator.addDays(candidateDate, 1);
    }

    return candidateDate;
  }

  private async generateWeeklyTargetOccurrence(
    habit: HabitEntity,
    today: string,
  ): Promise<void> {
    if (habit.weeklyTarget === null) {
      return;
    }

    const pendingOccurrence = await this.findOldestPendingOccurrence(habit.id);

    if (pendingOccurrence) {
      if (pendingOccurrence.scheduledDate === today) {
        return;
      }

      // Eine Weekly-Target-Chance gilt immer nur
      // bis zum nächsten Kalendertag.
      await this.occurrenceService.updateStatus(
        pendingOccurrence.id,
        HabitOccurrenceStatus.SKIPPED,
      );
    }

    const week = HabitScheduleCalculator.getWeekRange(today);

    const completedThisWeek = await this.occurrenceRepository.count({
      where: {
        habitId: habit.id,
        status: HabitOccurrenceStatus.COMPLETED,
        resolvedDate: Between(week.startDate, week.endDate),
      },
    });

    if (completedThisWeek >= habit.weeklyTarget) {
      return;
    }

    const occurrenceForToday = await this.occurrenceRepository.findOneBy({
      habitId: habit.id,
      scheduledDate: today,
    });

    if (occurrenceForToday) {
      return;
    }

    await this.occurrenceService.createPendingOccurrence(habit.id, today);
  }

  private findOldestPendingOccurrence(
    habitId: number,
  ): Promise<HabitOccurrenceEntity | null> {
    return this.occurrenceRepository.findOne({
      where: {
        habitId,
        status: HabitOccurrenceStatus.PENDING,
      },
      order: {
        scheduledDate: 'ASC',
        id: 'ASC',
      },
    });
  }

  private findOccurrencesForToday(
    today: string,
  ): Promise<HabitOccurrenceEntity[]> {
    return this.occurrenceRepository
      .createQueryBuilder('occurrence')
      .innerJoinAndSelect('occurrence.habit', 'habit')
      .where('"habit"."isActive" = :isActive', {
        isActive: true,
      })
      .andWhere('"habit"."deletedAt" IS NULL')
      .andWhere(
        new Brackets((queryBuilder) => {
          queryBuilder
            .where(
              `(
              "occurrence"."status" = :pendingStatus
              AND "occurrence"."scheduledDate" <= :today
            )`,
              {
                pendingStatus: HabitOccurrenceStatus.PENDING,
                today,
              },
            )
            .orWhere(
              `(
              "occurrence"."status" = :completedStatus
              AND "occurrence"."resolvedDate" = :today
            )`,
              {
                completedStatus: HabitOccurrenceStatus.COMPLETED,
                today,
              },
            )
            .orWhere(
              `(
              "occurrence"."status" = :skippedStatus
              AND "occurrence"."scheduledDate" = :today
              AND "occurrence"."resolvedDate" = :today
            )`,
              {
                skippedStatus: HabitOccurrenceStatus.SKIPPED,
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
