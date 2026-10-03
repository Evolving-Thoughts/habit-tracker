import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import {
  authenticatedRequest as request,
  seedAuth,
  TEST_USER,
} from './auth-fixture';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import {
  getCurrentDateInTimeZone,
  midnightInTimeZone,
} from '../src/common/date/date-only.utils';
import { DayPlannerResponseDto } from '../src/day-planner/dto/day-planner-response.dto';
import { ChangeHabitScheduleDto } from '../src/habits/dto/change-habit-schedule.dto';
import { CreateHabitDto } from '../src/habits/dto/create-habit.dto';
import { ScheduleDto } from '../src/habits/dto/schedule.dto';
import { HabitResponseDto } from '../src/habits/dto/habit-response.dto';
import { HabitEntity } from '../src/habits/entities/habit.entity';
import { HabitScheduleVersionEntity } from '../src/habits/entities/habit-schedule-version.entity';
import { HabitScheduleType } from '../src/habits/enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../src/habits/enums/missed-occurrence-policy.enum';
import { Weekday } from '../src/habits/enums/weekday.enum';
import { HabitsService } from '../src/habits/habits.service';
import { HabitSchedulingService } from '../src/habits/scheduling/habit-scheduling.service';
import { HabitOccurrenceResponseDto } from '../src/habit-occurrences/dto/habit-occurrence-response.dto';
import { HabitOccurrenceEntity } from '../src/habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../src/habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitScheduleCalculator } from '../src/habit-occurrences/scheduling/habit-schedule-calculator';
import { TodoEntity } from '../src/todos/entities/todo.entity';

describe('Habit domain and day planner (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;
  let scheduling: HabitSchedulingService;
  let habitService: HabitsService;

  const interval = (days = 2): ScheduleDto => ({
    type: HabitScheduleType.INTERVAL,
    intervalDays: days,
  });

  const date = (): string => getCurrentDateInTimeZone();

  const relativeDate = (days: number): string =>
    HabitScheduleCalculator.addDays(date(), days);

  async function clear(): Promise<void> {
    if (dataSource.options.database !== 'habit_tracker_test') {
      throw new Error('Refusing to delete non-test data');
    }

    await dataSource.query('DELETE FROM timers');
    await dataSource.transaction(async (manager) => {
      await manager
        .getRepository(HabitOccurrenceEntity)
        .createQueryBuilder()
        .delete()
        .execute();

      await manager
        .getRepository(HabitScheduleVersionEntity)
        .createQueryBuilder()
        .delete()
        .execute();

      await manager
        .getRepository(HabitEntity)
        .createQueryBuilder()
        .delete()
        .execute();

      await manager
        .getRepository(TodoEntity)
        .createQueryBuilder()
        .delete()
        .execute();
    });
  }

  async function create(
    overrides: Partial<CreateHabitDto> = {},
  ): Promise<HabitResponseDto> {
    const response = await request(server)
      .post('/habits')
      .send({
        title: 'Joggen',
        schedule: interval(),
        ...overrides,
      })
      .expect(201);

    return response.body as HabitResponseDto;
  }

  async function change(
    habitId: number,
    schedule: ScheduleDto,
    effectiveFrom?: string,
  ): Promise<HabitResponseDto> {
    const response = await request(server)
      .post(`/habits/${habitId}/schedule-changes`)
      .send({ schedule, effectiveFrom })
      .expect(201);

    return response.body as HabitResponseDto;
  }

  async function today(): Promise<HabitOccurrenceResponseDto[]> {
    const response = await request(server)
      .get('/habit-occurrences/today')
      .expect(200);

    return response.body as HabitOccurrenceResponseDto[];
  }

  async function status(
    occurrenceId: number,
    value: HabitOccurrenceStatus,
  ): Promise<HabitOccurrenceResponseDto> {
    const response = await request(server)
      .patch(`/habit-occurrences/${occurrenceId}/status`)
      .send({ status: value })
      .expect(200);

    return response.body as HabitOccurrenceResponseDto;
  }

  async function firstOccurrence(): Promise<HabitOccurrenceResponseDto> {
    const items = await today();
    const first = items[0];

    if (!first) {
      throw new Error('Expected occurrence');
    }

    return first;
  }

  async function seed(
    habitId: number,
    scheduledDate: string,
    value: HabitOccurrenceStatus,
    resolvedDate: string | null,
  ): Promise<HabitOccurrenceEntity> {
    const version = await dataSource
      .getRepository(HabitScheduleVersionEntity)
      .findOneByOrFail({ habitId });

    return dataSource.getRepository(HabitOccurrenceEntity).save(
      dataSource.getRepository(HabitOccurrenceEntity).create({
        habitId,
        scheduleVersionId: version.id,
        scheduledDate,
        status: value,
        resolvedDate,
        cancellationReason: null,
      }),
    );
  }

  async function pendingCount(habitId: number): Promise<number> {
    return dataSource.getRepository(HabitOccurrenceEntity).count({
      where: {
        habitId,
        status: HabitOccurrenceStatus.PENDING,
      },
    });
  }

  async function planner(): Promise<DayPlannerResponseDto> {
    const response = await request(server)
      .get('/day-planner/today')
      .expect(200);

    return response.body as DayPlannerResponseDto;
  }

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = fixture.createNestApplication();
    configureApp(app);
    await app.init();
    await seedAuth(app);

    dataSource = app.get(DataSource);

    if (dataSource.options.database !== 'habit_tracker_test') {
      await app.close();
      throw new Error('These tests require habit_tracker_test');
    }

    server = app.getHttpServer() as Server;
    scheduling = app.get(HabitSchedulingService);
    habitService = app.get(HabitsService);
  });

  beforeEach(async () => {
    await clear();
  });

  afterAll(async () => {
    if (!app) {
      return;
    }

    try {
      if (
        dataSource?.isInitialized &&
        dataSource.options.database === 'habit_tracker_test'
      ) {
        await clear();
      }
    } finally {
      await app.close();
    }
  });

  describe('habit API', () => {
    it('creates identity and initial schedule', async () => {
      const habit = await create();

      expect(habit.title).toBe('Joggen');
      expect(habit.currentSchedule?.schedule).toMatchObject({
        type: HabitScheduleType.INTERVAL,
        intervalDays: 2,
      });
      expect(habit.upcomingSchedule).toBeNull();

      expect(await dataSource.getRepository(HabitEntity).count()).toBe(1);

      expect(
        await dataSource.getRepository(HabitScheduleVersionEntity).count(),
      ).toBe(1);
    });

    it('keeps a future initial schedule upcoming', async () => {
      const habit = await create({ startDate: relativeDate(1) });

      expect(habit.currentSchedule).toBeNull();
      expect(habit.upcomingSchedule?.effectiveFrom).toBe(relativeDate(1));
      expect(await today()).toEqual([]);
    });

    it('creates fixed weekdays without irrelevant parameters', async () => {
      const habit = await create({
        schedule: {
          type: HabitScheduleType.FIXED_WEEKDAYS,
          weekdays: [Weekday.THURSDAY, Weekday.MONDAY],
        },
      });

      expect(habit.currentSchedule?.schedule).toMatchObject({
        type: HabitScheduleType.FIXED_WEEKDAYS,
        weekdays: [Weekday.MONDAY, Weekday.THURSDAY],
      });
    });

    it('creates weekly targets', async () => {
      const habit = await create({
        schedule: {
          type: HabitScheduleType.WEEKLY_TARGET,
          weeklyTarget: 3,
        },
      });

      expect(habit.currentSchedule?.schedule).toEqual({
        type: HabitScheduleType.WEEKLY_TARGET,
        weeklyTarget: 3,
      });
    });

    it('rejects mixed schedule parameters', async () => {
      await request(server)
        .post('/habits')
        .send({
          title: 'Invalid',
          schedule: {
            ...interval(),
            weekdays: [Weekday.MONDAY],
          },
        })
        .expect(400);
    });

    it('rejects missing and duplicate schedule parameters', async () => {
      await request(server)
        .post('/habits')
        .send({
          title: 'Invalid',
          schedule: { type: HabitScheduleType.INTERVAL },
        })
        .expect(400);

      await request(server)
        .post('/habits')
        .send({
          title: 'Invalid',
          schedule: {
            type: HabitScheduleType.FIXED_WEEKDAYS,
            weekdays: [Weekday.MONDAY, Weekday.MONDAY],
          },
        })
        .expect(400);
    });

    it('reads and lists habits', async () => {
      const habit = await create();

      const single = await request(server)
        .get(`/habits/${habit.id}`)
        .expect(200);

      const list = await request(server).get('/habits').expect(200);

      const body = single.body as HabitResponseDto;
      expect(body.timerOccurrenceId).toEqual(expect.any(Number));
      expect({ ...body, timerOccurrenceId: null }).toEqual(habit);
      expect(list.body).toEqual([body]);
    });

    it('updates metadata without changing the schedule', async () => {
      const habit = await create();

      const response = await request(server)
        .patch(`/habits/${habit.id}`)
        .send({ title: 'Morning run', isActive: false })
        .expect(200);

      const body = response.body as HabitResponseDto;

      expect(body.title).toBe('Morning run');
      expect(body.isActive).toBe(false);

      expect(
        await dataSource.getRepository(HabitScheduleVersionEntity).count(),
      ).toBe(1);
    });

    it('rejects empty updates and schedule fields on metadata PATCH', async () => {
      const habit = await create();

      await request(server).patch(`/habits/${habit.id}`).send({}).expect(400);

      await request(server)
        .patch(`/habits/${habit.id}`)
        .send({ intervalDays: 3 })
        .expect(400);
    });

    it('soft-deletes while retaining history', async () => {
      const habit = await create();
      await today();

      await request(server).delete(`/habits/${habit.id}`).expect(204);

      await request(server).get(`/habits/${habit.id}`).expect(404);

      expect(await today()).toEqual([]);

      expect(
        await dataSource.getRepository(HabitScheduleVersionEntity).count(),
      ).toBe(1);
    });

    it('returns validation and not-found errors for IDs', async () => {
      await request(server).get('/habits/invalid').expect(400);
      await request(server).get('/habits/2147483647').expect(404);
    });
  });

  describe('generation and status', () => {
    it('generates one version-linked occurrence idempotently', async () => {
      const habit = await create();
      const first = await today();

      expect(first).toHaveLength(1);
      expect(await today()).toEqual(first);
      expect(first[0]?.scheduleVersionId).toBe(habit.currentSchedule?.id);
    });

    it('serializes concurrent generation', async () => {
      const habit = await create();

      await Promise.all([today(), today(), today()]);

      expect(await pendingCount(habit.id)).toBe(1);
      expect(
        await dataSource.getRepository(HabitOccurrenceEntity).count(),
      ).toBe(1);
    });

    it('backfills interval misses without showing them today', async () => {
      const habit = await create({ startDate: relativeDate(-4) });
      const visible = await today();

      expect(visible).toHaveLength(1);
      expect(visible[0]?.scheduledDate).toBe(date());

      const rows = await dataSource.getRepository(HabitOccurrenceEntity).find({
        where: { habitId: habit.id },
        order: { scheduledDate: 'ASC' },
      });

      expect(rows.map((item) => item.status)).toEqual([
        HabitOccurrenceStatus.SKIPPED,
        HabitOccurrenceStatus.SKIPPED,
        HabitOccurrenceStatus.PENDING,
      ]);
    });

    it('keeps carry-over within the interval window', async () => {
      await create({ startDate: relativeDate(-1) });

      expect((await firstOccurrence()).scheduledDate).toBe(relativeDate(-1));
    });

    it('expires SKIP after the due day', async () => {
      const habit = await create({
        startDate: relativeDate(-1),
        schedule: {
          ...interval(),
          missedOccurrencePolicy: MissedOccurrencePolicy.SKIP,
        },
      });

      expect(await today()).toEqual([]);

      const rows = await dataSource
        .getRepository(HabitOccurrenceEntity)
        .find({ where: { habitId: habit.id } });

      expect(rows[0]?.status).toBe(HabitOccurrenceStatus.SKIPPED);
    });

    it.each([HabitOccurrenceStatus.COMPLETED, HabitOccurrenceStatus.SKIPPED])(
      'resolves as %s and allows reopening in the active window',
      async (value) => {
        await create();
        const occurrence = await firstOccurrence();

        const resolved = await status(occurrence.id, value);

        expect(resolved.resolvedDate).toBe(date());

        const reopened = await status(
          occurrence.id,
          HabitOccurrenceStatus.PENDING,
        );

        expect(reopened.resolvedDate).toBeNull();
      },
    );

    it('keeps repeated status submissions idempotent', async () => {
      await create();
      const occurrence = await firstOccurrence();

      await status(occurrence.id, HabitOccurrenceStatus.COMPLETED);

      const before = await dataSource
        .getRepository(HabitOccurrenceEntity)
        .findOneByOrFail({ id: occurrence.id });

      await status(occurrence.id, HabitOccurrenceStatus.COMPLETED);

      const after = await dataSource
        .getRepository(HabitOccurrenceEntity)
        .findOneByOrFail({ id: occurrence.id });

      expect(after.updatedAt).toEqual(before.updatedAt);
    });

    it('rejects changing completed directly to skipped', async () => {
      await create();
      const occurrence = await firstOccurrence();

      await status(occurrence.id, HabitOccurrenceStatus.COMPLETED);

      await request(server)
        .patch(`/habit-occurrences/${occurrence.id}/status`)
        .send({ status: HabitOccurrenceStatus.SKIPPED })
        .expect(409);
    });

    it('stops weekly opportunities after reaching the target', async () => {
      const habit = await create({
        schedule: {
          type: HabitScheduleType.WEEKLY_TARGET,
          weeklyTarget: 1,
        },
      });

      const occurrence = await firstOccurrence();

      await status(occurrence.id, HabitOccurrenceStatus.COMPLETED);

      expect(await pendingCount(habit.id)).toBe(0);
      expect((await today())[0]?.status).toBe(HabitOccurrenceStatus.COMPLETED);
    });

    it('rejects invalid manual statuses', async () => {
      await create();
      const occurrence = await firstOccurrence();

      await request(server)
        .patch(`/habit-occurrences/${occurrence.id}/status`)
        .send({ status: HabitOccurrenceStatus.CANCELLED })
        .expect(400);
    });
  });

  describe('schedule changes', () => {
    it('switches immediately and cancels the old pending occurrence', async () => {
      const habit = await create();
      const original = await firstOccurrence();

      const changed = await change(habit.id, interval(3));

      expect(changed.currentSchedule?.schedule).toMatchObject({
        intervalDays: 3,
      });

      const old = await dataSource
        .getRepository(HabitOccurrenceEntity)
        .findOneByOrFail({ id: original.id });

      expect(old.status).toBe(HabitOccurrenceStatus.CANCELLED);
      expect(old.cancellationReason).toBe('schedule_changed');
      expect(await pendingCount(habit.id)).toBe(1);
    });

    it('does not create another pending occurrence after completion today', async () => {
      const habit = await create();
      const original = await firstOccurrence();

      await status(original.id, HabitOccurrenceStatus.COMPLETED);

      await change(habit.id, interval(3));

      expect(await pendingCount(habit.id)).toBe(0);

      const visible = await today();

      expect(visible).toHaveLength(1);
      expect(visible[0]?.id).toBe(original.id);
    });

    it('keeps past misses skipped when changing rules', async () => {
      const habit = await create({ startDate: relativeDate(-4) });

      await change(habit.id, interval(3));

      const oldMiss = await dataSource
        .getRepository(HabitOccurrenceEntity)
        .findOneByOrFail({
          habitId: habit.id,
          scheduledDate: relativeDate(-4),
        });

      expect(oldMiss.status).toBe(HabitOccurrenceStatus.SKIPPED);
    });

    it('keeps future changes upcoming and activates them at the boundary', async () => {
      const habit = await create();
      const original = await firstOccurrence();
      const tomorrow = relativeDate(1);

      const changed = await change(habit.id, interval(3), tomorrow);

      expect(changed.currentSchedule?.schedule).toMatchObject({
        intervalDays: 2,
      });

      expect(changed.upcomingSchedule?.effectiveFrom).toBe(tomorrow);

      const before = await dataSource
        .getRepository(HabitOccurrenceEntity)
        .findOneByOrFail({ id: original.id });

      expect(before.status).toBe(HabitOccurrenceStatus.PENDING);

      await scheduling.generateForHabit(
        TEST_USER,
        habit.id,
        new Date(midnightInTimeZone(tomorrow).getTime() + 1000),
      );

      const after = await dataSource
        .getRepository(HabitOccurrenceEntity)
        .findOneByOrFail({ id: original.id });

      expect(after.status).toBe(HabitOccurrenceStatus.CANCELLED);

      const pending = await dataSource
        .getRepository(HabitOccurrenceEntity)
        .findOneByOrFail({
          habitId: habit.id,
          status: HabitOccurrenceStatus.PENDING,
        });

      expect(pending.scheduledDate).toBe(tomorrow);
      expect(pending.scheduleVersionId).toBe(changed.upcomingSchedule?.id);
    });

    it('uses the old expiry rule for delayed activation', async () => {
      const habit = await create();
      await today();

      const changeDate = relativeDate(3);

      await change(habit.id, interval(3), changeDate);

      await scheduling.generateForHabit(
        '11111111-1111-4111-8111-111111111111',
        habit.id,
        new Date(midnightInTimeZone(changeDate).getTime() + 1000),
      );

      const rows = await dataSource
        .getRepository(HabitOccurrenceEntity)
        .find({ where: { habitId: habit.id } });

      expect(rows.find((item) => item.scheduledDate === date())?.status).toBe(
        HabitOccurrenceStatus.SKIPPED,
      );

      expect(
        rows.find((item) => item.scheduledDate === relativeDate(2))?.status,
      ).toBe(HabitOccurrenceStatus.CANCELLED);
    });

    it('replaces an upcoming change', async () => {
      const habit = await create();

      const first = await change(habit.id, interval(3), relativeDate(2));

      const second = await change(habit.id, interval(4), relativeDate(4));

      expect(second.upcomingSchedule?.effectiveFrom).toBe(relativeDate(4));

      const cancelled = await dataSource
        .getRepository(HabitScheduleVersionEntity)
        .findOneByOrFail({
          id: first.upcomingSchedule?.id,
        });

      expect(cancelled.cancelledAt).toBeInstanceOf(Date);
    });

    it('handles multiple immediate changes on the same day', async () => {
      const habit = await create();
      await today();

      await change(habit.id, interval(3));
      await change(habit.id, interval(4));

      expect(await pendingCount(habit.id)).toBe(1);

      expect(
        await dataSource.getRepository(HabitScheduleVersionEntity).count(),
      ).toBe(3);
    });

    it('avoids an unnecessary version for an identical current rule', async () => {
      const habit = await create();

      await change(habit.id, interval());

      expect(
        await dataSource.getRepository(HabitScheduleVersionEntity).count(),
      ).toBe(1);
    });

    it('supports changing habit types', async () => {
      const habit = await create();

      const changed = await change(habit.id, {
        type: HabitScheduleType.FIXED_WEEKDAYS,
        weekdays: [Weekday.MONDAY, Weekday.THURSDAY],
      });

      expect(changed.currentSchedule?.schedule.type).toBe(
        HabitScheduleType.FIXED_WEEKDAYS,
      );
    });

    it('preserves weekly completions across versions', async () => {
      const week = HabitScheduleCalculator.getWeekRange(date());

      const habit = await create({
        startDate: week.startDate,
        schedule: interval(1),
      });

      await seed(
        habit.id,
        week.startDate,
        HabitOccurrenceStatus.COMPLETED,
        week.startDate,
      );

      await change(habit.id, {
        type: HabitScheduleType.WEEKLY_TARGET,
        weeklyTarget: 1,
      });

      expect(await pendingCount(habit.id)).toBe(0);

      expect(
        await dataSource.getRepository(HabitOccurrenceEntity).count({
          where: {
            habitId: habit.id,
            status: HabitOccurrenceStatus.COMPLETED,
          },
        }),
      ).toBe(1);
    });

    it('does not allow reopening cancelled occurrences', async () => {
      const habit = await create();
      const old = await firstOccurrence();

      await change(habit.id, interval(3));

      await request(server)
        .patch(`/habit-occurrences/${old.id}/status`)
        .send({ status: HabitOccurrenceStatus.PENDING })
        .expect(409);
    });

    it('rejects retroactive changes', async () => {
      const habit = await create();

      await request(server)
        .post(`/habits/${habit.id}/schedule-changes`)
        .send({
          effectiveFrom: relativeDate(-1),
          schedule: interval(3),
        })
        .expect(400);
    });

    it('exposes version history', async () => {
      const habit = await create();
      await change(habit.id, interval(3));

      const response = await request(server)
        .get(`/habits/${habit.id}/schedule-versions`)
        .expect(200);

      const versions = response.body as Array<{ id: number }>;

      expect(versions).toHaveLength(2);
    });

    it('rolls back creation if saving the first version fails', async () => {
      const constraint = 'CHK_test_reject_interval_13';

      await dataSource.query(`
        ALTER TABLE "habit_schedule_versions"
        ADD CONSTRAINT "${constraint}"
        CHECK ("intervalDays" IS NULL OR "intervalDays" <> 13)
      `);

      try {
        await expect(
          habitService.create('11111111-1111-4111-8111-111111111111', {
            title: 'Rollback',
            schedule: interval(13),
          }),
        ).rejects.toThrow();

        expect(await dataSource.getRepository(HabitEntity).count()).toBe(0);
      } finally {
        await dataSource.query(`
          ALTER TABLE "habit_schedule_versions"
          DROP CONSTRAINT IF EXISTS "${constraint}"
        `);
      }
    });

    it('rolls back a failed schedule change', async () => {
      const habit = await create();
      await today();

      const constraint = 'CHK_test_reject_interval_13';

      await dataSource.query(`
        ALTER TABLE "habit_schedule_versions"
        ADD CONSTRAINT "${constraint}"
        CHECK ("intervalDays" IS NULL OR "intervalDays" <> 13)
      `);

      try {
        const dto: ChangeHabitScheduleDto = {
          schedule: interval(13),
        };

        await expect(
          habitService.changeSchedule(
            '11111111-1111-4111-8111-111111111111',
            habit.id,
            dto,
          ),
        ).rejects.toThrow();

        const versions = await dataSource
          .getRepository(HabitScheduleVersionEntity)
          .find({ where: { habitId: habit.id } });

        expect(versions).toHaveLength(1);
        expect(versions[0]?.endsAt).toBeNull();
        expect(await pendingCount(habit.id)).toBe(1);
      } finally {
        await dataSource.query(`
          ALTER TABLE "habit_schedule_versions"
          DROP CONSTRAINT IF EXISTS "${constraint}"
        `);
      }
    });
  });

  describe('day planner', () => {
    it('combines due todos with habits and excludes dump/future todos', async () => {
      const repository = dataSource.getRepository(TodoEntity);

      await repository.save(
        repository.create({
          userId: TEST_USER,
          title: 'Overdue',
          completed: false,
          completedAt: null,
          scheduledAt: new Date(`${relativeDate(-1)}T08:00:00Z`),
          plannedDurationMinutes: 30,
          isFixed: false,
        }),
      );

      await repository.save(
        repository.create({
          userId: TEST_USER,
          title: 'Dump',
          completed: false,
          completedAt: null,
          scheduledAt: null,
          plannedDurationMinutes: null,
          isFixed: false,
        }),
      );

      await repository.save(
        repository.create({
          userId: TEST_USER,
          title: 'Future',
          completed: false,
          completedAt: null,
          scheduledAt: new Date(`${relativeDate(1)}T08:00:00Z`),
          plannedDurationMinutes: null,
          isFixed: false,
        }),
      );

      await create();

      const result = await planner();

      expect(result.items).toHaveLength(2);
      expect(result.items.map((item) => item.title)).toEqual([
        'Overdue',
        'Joggen',
      ]);
    });

    it('keeps completed habits visible today', async () => {
      await create();
      const occurrence = await firstOccurrence();

      await status(occurrence.id, HabitOccurrenceStatus.COMPLETED);

      expect((await planner()).items).toEqual([
        expect.objectContaining({
          occurrenceId: occurrence.id,
          status: HabitOccurrenceStatus.COMPLETED,
        }),
      ]);
    });

    it('excludes historical backfilled skips', async () => {
      await create({ startDate: relativeDate(-4) });

      const result = await planner();

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.status).toBe(HabitOccurrenceStatus.PENDING);
    });

    it('includes late completions recorded today', async () => {
      const habit = await create({ startDate: relativeDate(-1) });

      const occurrence = await seed(
        habit.id,
        relativeDate(-1),
        HabitOccurrenceStatus.COMPLETED,
        date(),
      );

      expect((await planner()).items).toEqual([
        expect.objectContaining({
          occurrenceId: occurrence.id,
          scheduledDate: relativeDate(-1),
          status: HabitOccurrenceStatus.COMPLETED,
        }),
      ]);
    });

    it('keeps a skip visible if its scheduled date is today', async () => {
      await create();
      const occurrence = await firstOccurrence();

      await status(occurrence.id, HabitOccurrenceStatus.SKIPPED);

      expect((await planner()).items[0]?.status).toBe(
        HabitOccurrenceStatus.SKIPPED,
      );
    });

    it('excludes habits completed on previous days', async () => {
      const habit = await create({ startDate: relativeDate(-1) });

      await seed(
        habit.id,
        relativeDate(-1),
        HabitOccurrenceStatus.COMPLETED,
        relativeDate(-1),
      );

      expect((await planner()).items).toEqual([]);
    });

    it('excludes cancelled occurrences', async () => {
      const habit = await create();
      await today();

      await change(habit.id, interval(3));

      const result = await planner();

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.status).toBe(HabitOccurrenceStatus.PENDING);
    });

    it('returns an empty planner when nothing is due', async () => {
      expect(await planner()).toEqual({
        date: date(),
        items: [],
      });
    });
  });
});
