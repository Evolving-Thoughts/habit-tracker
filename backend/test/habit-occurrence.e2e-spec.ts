import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Server } from 'node:http';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { getCurrentDateInTimeZone } from '../src/common/date/date-only.utils';
import { configureApp } from '../src/configure-app';
import { HabitOccurrenceEntity } from '../src/habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../src/habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitScheduleCalculator } from '../src/habit-occurrences/scheduling/habit-schedule-calculator';
import { HabitEntity } from '../src/habits/entities/habit.entity';
import { HabitScheduleType } from '../src/habits/enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../src/habits/enums/missed-occurrence-policy.enum';

type HabitResponseBody = {
  id: number;
  title: string;
  scheduleType: HabitScheduleType;
  startDate: string;
  intervalDays: number | null;
  weekdays: string[] | null;
  weeklyTarget: number | null;
  missedOccurrencePolicy: MissedOccurrencePolicy;
  isActive: boolean;
};

type HabitOccurrenceResponseBody = {
  id: number;
  habitId: number;
  scheduledDate: string;
  status: HabitOccurrenceStatus;
  resolvedDate: string | null;
};

type ErrorResponseBody = {
  statusCode: number;
  message: string | string[];
  error: string;
};

describe('Habit occurrences API (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let habitRepository: Repository<HabitEntity>;
  let occurrenceRepository: Repository<HabitOccurrenceEntity>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);

    await app.init();

    httpServer = app.getHttpServer() as Server;

    habitRepository = moduleFixture.get<Repository<HabitEntity>>(
      getRepositoryToken(HabitEntity),
    );

    occurrenceRepository = moduleFixture.get<Repository<HabitOccurrenceEntity>>(
      getRepositoryToken(HabitOccurrenceEntity),
    );
  });

  beforeEach(async () => {
    await occurrenceRepository.createQueryBuilder().delete().execute();

    await habitRepository.createQueryBuilder().delete().execute();
  });

  afterAll(async () => {
    await app.close();
  });

  async function createIntervalHabit(
    startDate: string,
  ): Promise<HabitResponseBody> {
    const response = await request(httpServer)
      .post('/habits')
      .send({
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        startDate,
        intervalDays: 2,
        missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
      })
      .expect(201);

    return response.body as HabitResponseBody;
  }

  async function getTodayOccurrences(): Promise<HabitOccurrenceResponseBody[]> {
    const response = await request(httpServer)
      .get('/habit-occurrences/today')
      .expect(200);

    return response.body as HabitOccurrenceResponseBody[];
  }

  async function createStoredOccurrence(
    habitId: number,
    scheduledDate: string,
    status: HabitOccurrenceStatus,
    resolvedDate: string | null,
  ): Promise<HabitOccurrenceEntity> {
    const occurrence = occurrenceRepository.create({
      habitId,
      scheduledDate,
      status,
      resolvedDate,
    });

    return occurrenceRepository.save(occurrence);
  }

  describe('GET /habit-occurrences/today', () => {
    it('generates a due occurrence and does not duplicate it', async () => {
      const today = getCurrentDateInTimeZone();
      const habit = await createIntervalHabit(today);

      const firstOccurrences = await getTodayOccurrences();

      expect(firstOccurrences).toHaveLength(1);

      expect(firstOccurrences[0]).toEqual({
        id: expect.any(Number) as number,
        habitId: habit.id,
        scheduledDate: today,
        status: HabitOccurrenceStatus.PENDING,
        resolvedDate: null,
      });

      const secondOccurrences = await getTodayOccurrences();

      expect(secondOccurrences).toEqual(firstOccurrences);

      expect(
        await occurrenceRepository.count({
          where: {
            habitId: habit.id,
          },
        }),
      ).toBe(1);
    });

    it('keeps backfilled skips in history but excludes them from today', async () => {
      const today = getCurrentDateInTimeZone();

      const fourDaysAgo = HabitScheduleCalculator.addDays(today, -4);

      const twoDaysAgo = HabitScheduleCalculator.addDays(today, -2);

      const habit = await createIntervalHabit(fourDaysAgo);

      const todayOccurrences = await getTodayOccurrences();

      expect(todayOccurrences).toHaveLength(1);

      const currentOccurrence = todayOccurrences[0];

      expect(currentOccurrence).toEqual({
        id: expect.any(Number) as number,
        habitId: habit.id,
        scheduledDate: today,
        status: HabitOccurrenceStatus.PENDING,
        resolvedDate: null,
      });

      const historyResponse = await request(httpServer)
        .get(`/habits/${habit.id}/occurrences`)
        .expect(200);

      const history = historyResponse.body as HabitOccurrenceResponseBody[];

      expect(history).toEqual([
        {
          id: expect.any(Number) as number,
          habitId: habit.id,
          scheduledDate: fourDaysAgo,
          status: HabitOccurrenceStatus.SKIPPED,
          resolvedDate: today,
        },
        {
          id: expect.any(Number) as number,
          habitId: habit.id,
          scheduledDate: twoDaysAgo,
          status: HabitOccurrenceStatus.SKIPPED,
          resolvedDate: today,
        },
        currentOccurrence,
      ]);

      // Ein erneuter Aufruf darf weder historische
      // noch aktuelle Ausführungen duplizieren.
      expect(await getTodayOccurrences()).toEqual(todayOccurrences);

      expect(
        await occurrenceRepository.count({
          where: {
            habitId: habit.id,
          },
        }),
      ).toBe(3);
    });

    it('includes a late occurrence completed today', async () => {
      const today = getCurrentDateInTimeZone();

      const yesterday = HabitScheduleCalculator.addDays(today, -1);

      const habit = await createIntervalHabit(yesterday);

      const occurrence = await createStoredOccurrence(
        habit.id,
        yesterday,
        HabitOccurrenceStatus.COMPLETED,
        today,
      );

      expect(await getTodayOccurrences()).toEqual([
        {
          id: occurrence.id,
          habitId: habit.id,
          scheduledDate: yesterday,
          status: HabitOccurrenceStatus.COMPLETED,
          resolvedDate: today,
        },
      ]);
    });

    it('excludes an occurrence completed on a previous day', async () => {
      const today = getCurrentDateInTimeZone();

      const yesterday = HabitScheduleCalculator.addDays(today, -1);

      const habit = await createIntervalHabit(yesterday);

      await createStoredOccurrence(
        habit.id,
        yesterday,
        HabitOccurrenceStatus.COMPLETED,
        yesterday,
      );

      // Bei einem Zwei-Tage-Intervall ist der
      // nächste Termin erst morgen.
      expect(await getTodayOccurrences()).toEqual([]);

      expect(
        await occurrenceRepository.count({
          where: {
            habitId: habit.id,
          },
        }),
      ).toBe(1);
    });

    it('excludes an occurrence skipped on a previous day', async () => {
      const today = getCurrentDateInTimeZone();

      const yesterday = HabitScheduleCalculator.addDays(today, -1);

      const habit = await createIntervalHabit(yesterday);

      await createStoredOccurrence(
        habit.id,
        yesterday,
        HabitOccurrenceStatus.SKIPPED,
        yesterday,
      );

      expect(await getTodayOccurrences()).toEqual([]);

      expect(
        await occurrenceRepository.count({
          where: {
            habitId: habit.id,
          },
        }),
      ).toBe(1);
    });

    it('does not generate occurrences for an inactive habit', async () => {
      const today = getCurrentDateInTimeZone();
      const habit = await createIntervalHabit(today);

      await request(httpServer)
        .patch(`/habits/${habit.id}`)
        .send({
          isActive: false,
        })
        .expect(200);

      expect(await getTodayOccurrences()).toEqual([]);
      expect(await occurrenceRepository.count()).toBe(0);
    });

    it('does not generate occurrences for a soft-deleted habit', async () => {
      const today = getCurrentDateInTimeZone();
      const habit = await createIntervalHabit(today);

      await request(httpServer).delete(`/habits/${habit.id}`).expect(204);

      expect(await getTodayOccurrences()).toEqual([]);
      expect(await occurrenceRepository.count()).toBe(0);
    });
  });

  describe('occurrence lifecycle', () => {
    it('completes, resets and skips an occurrence', async () => {
      const today = getCurrentDateInTimeZone();
      const habit = await createIntervalHabit(today);

      const occurrences = await getTodayOccurrences();

      const occurrence = occurrences[0];

      if (!occurrence) {
        throw new Error('Expected a generated occurrence');
      }

      const completedResponse = await request(httpServer)
        .patch(`/habit-occurrences/${occurrence.id}/status`)
        .send({
          status: HabitOccurrenceStatus.COMPLETED,
        })
        .expect(200);

      const completedOccurrence =
        completedResponse.body as HabitOccurrenceResponseBody;

      expect(completedOccurrence).toEqual({
        ...occurrence,
        status: HabitOccurrenceStatus.COMPLETED,
        resolvedDate: today,
      });

      expect(await getTodayOccurrences()).toEqual([completedOccurrence]);

      const resetResponse = await request(httpServer)
        .patch(`/habit-occurrences/${occurrence.id}/status`)
        .send({
          status: HabitOccurrenceStatus.PENDING,
        })
        .expect(200);

      const resetOccurrence = resetResponse.body as HabitOccurrenceResponseBody;

      expect(resetOccurrence).toEqual({
        ...occurrence,
        status: HabitOccurrenceStatus.PENDING,
        resolvedDate: null,
      });

      const skippedResponse = await request(httpServer)
        .patch(`/habit-occurrences/${occurrence.id}/status`)
        .send({
          status: HabitOccurrenceStatus.SKIPPED,
        })
        .expect(200);

      const skippedOccurrence =
        skippedResponse.body as HabitOccurrenceResponseBody;

      expect(skippedOccurrence).toEqual({
        ...occurrence,
        status: HabitOccurrenceStatus.SKIPPED,
        resolvedDate: today,
      });

      // Ein für heute geplanter und heute
      // übersprungener Termin bleibt sichtbar.
      expect(await getTodayOccurrences()).toEqual([skippedOccurrence]);

      const historyResponse = await request(httpServer)
        .get(`/habits/${habit.id}/occurrences`)
        .expect(200);

      expect(historyResponse.body as HabitOccurrenceResponseBody[]).toEqual([
        skippedOccurrence,
      ]);
    });

    it('rejects a direct change from completed to skipped', async () => {
      const today = getCurrentDateInTimeZone();
      const habit = await createIntervalHabit(today);

      const occurrence = await createStoredOccurrence(
        habit.id,
        today,
        HabitOccurrenceStatus.COMPLETED,
        today,
      );

      const response = await request(httpServer)
        .patch(`/habit-occurrences/${occurrence.id}/status`)
        .send({
          status: HabitOccurrenceStatus.SKIPPED,
        })
        .expect(409);

      const body = response.body as ErrorResponseBody;

      expect(body.statusCode).toBe(409);
      expect(body.message).toBe(
        'Cannot change occurrence status from completed to skipped',
      );

      const unchangedOccurrence = await occurrenceRepository.findOneBy({
        id: occurrence.id,
      });

      expect(unchangedOccurrence?.status).toBe(HabitOccurrenceStatus.COMPLETED);
    });
  });

  describe('validation and missing resources', () => {
    it('rejects an invalid status', async () => {
      const today = getCurrentDateInTimeZone();
      const habit = await createIntervalHabit(today);

      const occurrence = await createStoredOccurrence(
        habit.id,
        today,
        HabitOccurrenceStatus.PENDING,
        null,
      );

      const response = await request(httpServer)
        .patch(`/habit-occurrences/${occurrence.id}/status`)
        .send({
          status: 'invalid-status',
        })
        .expect(400);

      const body = response.body as ErrorResponseBody;

      expect(body.statusCode).toBe(400);
    });

    it('returns 400 for a non-numeric occurrence ID', async () => {
      await request(httpServer)
        .patch('/habit-occurrences/not-a-number/status')
        .send({
          status: HabitOccurrenceStatus.COMPLETED,
        })
        .expect(400);
    });

    it('returns 404 for a missing occurrence', async () => {
      const response = await request(httpServer)
        .patch('/habit-occurrences/999999/status')
        .send({
          status: HabitOccurrenceStatus.COMPLETED,
        })
        .expect(404);

      const body = response.body as ErrorResponseBody;

      expect(body.statusCode).toBe(404);
      expect(body.message).toBe(
        'Habit occurrence with ID 999999 was not found',
      );
    });

    it('returns 404 when listing occurrences for a missing habit', async () => {
      const response = await request(httpServer)
        .get('/habits/999999/occurrences')
        .expect(404);

      const body = response.body as ErrorResponseBody;

      expect(body.statusCode).toBe(404);
      expect(body.message).toBe('Habit with ID 999999 was not found');
    });
  });
});
