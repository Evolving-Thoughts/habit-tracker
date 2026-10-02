import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { HabitEntity } from '../src/habits/entities/habit.entity';
import { HabitScheduleVersionEntity } from '../src/habits/entities/habit-schedule-version.entity';
import { HabitOccurrenceEntity } from '../src/habit-occurrences/entities/habit-occurrence.entity';
import { CreateHabitDto } from '../src/habits/dto/create-habit.dto';
import { HabitScheduleType } from '../src/habits/enums/habit-schedule-type.enum';
import { Weekday } from '../src/habits/enums/weekday.enum';
import { HabitsService } from '../src/habits/habits.service';

describe('Habit schedule creation (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let service: HabitsService;
  let habitRepository: Repository<HabitEntity>;
  let versionRepository: Repository<HabitScheduleVersionEntity>;

  const rollbackConstraint =
    'CHK_test_habit_schedule_version_reject_interval_13';

  async function cleanup(): Promise<void> {
    await dataSource
      .getRepository(HabitOccurrenceEntity)
      .createQueryBuilder()
      .delete()
      .execute();

    await versionRepository.createQueryBuilder().delete().execute();
    await habitRepository.createQueryBuilder().delete().execute();
  }

  async function dropRollbackConstraint(): Promise<void> {
    await dataSource.query(`
      ALTER TABLE "habit_schedule_versions"
      DROP CONSTRAINT IF EXISTS
      "${rollbackConstraint}"
    `);
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);

    if (dataSource.options.database !== 'habit_tracker_test') {
      await app.close();
      throw new Error('These tests may only run against habit_tracker_test.');
    }

    service = app.get(HabitsService);
    habitRepository = dataSource.getRepository(HabitEntity);
    versionRepository = dataSource.getRepository(HabitScheduleVersionEntity);

    // Entfernt eine eventuell von einem abgebrochenen Test verbliebene
    // Test-Constraint.
    await dropRollbackConstraint();
  });

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    try {
      if (versionRepository) {
        await dropRollbackConstraint();
        await cleanup();
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  const cases: Array<{
    name: string;
    input: CreateHabitDto;
    expectedFirstDueDate: string | null;
  }> = [
    {
      name: 'interval',
      input: {
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        startDate: '2026-10-01',
        intervalDays: 2,
      },
      expectedFirstDueDate: '2026-10-01',
    },
    {
      name: 'fixed weekdays',
      input: {
        title: 'Putzen',
        scheduleType: HabitScheduleType.FIXED_WEEKDAYS,
        startDate: '2026-10-01',
        weekdays: [Weekday.MONDAY, Weekday.THURSDAY],
      },
      expectedFirstDueDate: null,
    },
    {
      name: 'weekly target',
      input: {
        title: 'Gitarre',
        scheduleType: HabitScheduleType.WEEKLY_TARGET,
        startDate: '2026-10-01',
        weeklyTarget: 3,
      },
      expectedFirstDueDate: null,
    },
  ];

  it.each(cases)(
    'persists a habit and its first version for $name',
    async ({ input, expectedFirstDueDate }) => {
      const habit = await service.create(input);

      const persistedHabit = await habitRepository.findOneByOrFail({
        id: habit.id,
      });

      const versions = await versionRepository.find({
        where: { habitId: habit.id },
      });

      expect(persistedHabit.title).toBe(input.title);
      expect(versions).toHaveLength(1);

      expect(versions[0]).toMatchObject({
        habitId: habit.id,
        scheduleType: habit.scheduleType,
        validFrom: habit.startDate,
        validUntil: null,
        firstDueDate: expectedFirstDueDate,
        intervalDays: habit.intervalDays,
        weekdays: habit.weekdays,
        weeklyTarget: habit.weeklyTarget,
        missedOccurrencePolicy: habit.missedOccurrencePolicy,
      });
    },
  );

  it('rolls back the habit if saving its first version fails', async () => {
    await dataSource.query(`
      ALTER TABLE "habit_schedule_versions"
      ADD CONSTRAINT "${rollbackConstraint}"
      CHECK ("intervalDays" IS NULL OR "intervalDays" <> 13)
    `);

    try {
      await expect(
        service.create({
          title: 'Rollback test',
          scheduleType: HabitScheduleType.INTERVAL,
          startDate: '2026-10-01',
          intervalDays: 13,
        }),
      ).rejects.toThrow();

      expect(await habitRepository.count()).toBe(0);
      expect(await versionRepository.count()).toBe(0);
    } finally {
      await dropRollbackConstraint();
    }
  });
});
