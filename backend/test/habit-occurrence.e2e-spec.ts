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

  describe('GET /habit-occurrences/today', () => {
    it('generates a due occurrence and does not duplicate it', async () => {
      const today = getCurrentDateInTimeZone();

      const createHabitResponse = await request(httpServer)
        .post('/habits')
        .send({
          title: 'Joggen',
          scheduleType: HabitScheduleType.INTERVAL,
          startDate: today,
          intervalDays: 2,
        })
        .expect(201);

      const habit = createHabitResponse.body as HabitResponseBody;

      const firstTodayResponse = await request(httpServer)
        .get('/habit-occurrences/today')
        .expect(200);

      const firstTodayOccurrences =
        firstTodayResponse.body as HabitOccurrenceResponseBody[];

      expect(firstTodayOccurrences).toHaveLength(1);

      expect(firstTodayOccurrences[0]).toEqual({
        id: expect.any(Number) as number,
        habitId: habit.id,
        scheduledDate: today,
        status: HabitOccurrenceStatus.PENDING,
        resolvedDate: null,
      });

      const secondTodayResponse = await request(httpServer)
        .get('/habit-occurrences/today')
        .expect(200);

      const secondTodayOccurrences =
        secondTodayResponse.body as HabitOccurrenceResponseBody[];

      expect(secondTodayOccurrences).toEqual(firstTodayOccurrences);

      expect(
        await occurrenceRepository.count({
          where: {
            habitId: habit.id,
          },
        }),
      ).toBe(1);
    });

    it('backfills missed interval dates using the fixed rhythm', async () => {
      const today = getCurrentDateInTimeZone();

      const fourDaysAgo = HabitScheduleCalculator.addDays(today, -4);

      const twoDaysAgo = HabitScheduleCalculator.addDays(today, -2);

      const createHabitResponse = await request(httpServer)
        .post('/habits')
        .send({
          title: 'Joggen',
          scheduleType: HabitScheduleType.INTERVAL,
          startDate: fourDaysAgo,
          intervalDays: 2,
          missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
        })
        .expect(201);

      const habit = createHabitResponse.body as HabitResponseBody;

      const todayResponse = await request(httpServer)
        .get('/habit-occurrences/today')
        .expect(200);

      const occurrences = todayResponse.body as HabitOccurrenceResponseBody[];

      expect(occurrences).toHaveLength(3);

      expect(occurrences).toEqual([
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
        {
          id: expect.any(Number) as number,
          habitId: habit.id,
          scheduledDate: today,
          status: HabitOccurrenceStatus.PENDING,
          resolvedDate: null,
        },
      ]);

      const historyResponse = await request(httpServer)
        .get(`/habits/${habit.id}/occurrences`)
        .expect(200);

      const history = historyResponse.body as HabitOccurrenceResponseBody[];

      expect(history).toEqual(occurrences);
    });

    it('does not generate occurrences for an inactive habit', async () => {
      const today = getCurrentDateInTimeZone();

      const createHabitResponse = await request(httpServer)
        .post('/habits')
        .send({
          title: 'Joggen',
          scheduleType: HabitScheduleType.INTERVAL,
          startDate: today,
          intervalDays: 2,
        })
        .expect(201);

      const habit = createHabitResponse.body as HabitResponseBody;

      await request(httpServer)
        .patch(`/habits/${habit.id}`)
        .send({
          isActive: false,
        })
        .expect(200);

      const response = await request(httpServer)
        .get('/habit-occurrences/today')
        .expect(200);

      const occurrences = response.body as HabitOccurrenceResponseBody[];

      expect(occurrences).toEqual([]);

      expect(await occurrenceRepository.count()).toBe(0);
    });

    it('does not generate occurrences for a soft-deleted habit', async () => {
      const today = getCurrentDateInTimeZone();

      const createHabitResponse = await request(httpServer)
        .post('/habits')
        .send({
          title: 'Joggen',
          scheduleType: HabitScheduleType.INTERVAL,
          startDate: today,
          intervalDays: 2,
        })
        .expect(201);

      const habit = createHabitResponse.body as HabitResponseBody;

      await request(httpServer).delete(`/habits/${habit.id}`).expect(204);

      const response = await request(httpServer)
        .get('/habit-occurrences/today')
        .expect(200);

      const occurrences = response.body as HabitOccurrenceResponseBody[];

      expect(occurrences).toEqual([]);

      expect(await occurrenceRepository.count()).toBe(0);
    });
  });

  describe('occurrence lifecycle', () => {
    it('completes, resets and skips an occurrence', async () => {
      const today = getCurrentDateInTimeZone();

      const createHabitResponse = await request(httpServer)
        .post('/habits')
        .send({
          title: 'Joggen',
          scheduleType: HabitScheduleType.INTERVAL,
          startDate: today,
          intervalDays: 2,
        })
        .expect(201);

      const habit = createHabitResponse.body as HabitResponseBody;

      const todayResponse = await request(httpServer)
        .get('/habit-occurrences/today')
        .expect(200);

      const todayOccurrences =
        todayResponse.body as HabitOccurrenceResponseBody[];

      const occurrence = todayOccurrences[0];

      expect(occurrence).toBeDefined();

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

      const completedTodayResponse = await request(httpServer)
        .get('/habit-occurrences/today')
        .expect(200);

      const completedTodayOccurrences =
        completedTodayResponse.body as HabitOccurrenceResponseBody[];

      expect(completedTodayOccurrences).toContainEqual(completedOccurrence);

      const resetResponse = await request(httpServer)
        .patch(`/habit-occurrences/${occurrence.id}/status`)
        .send({
          status: HabitOccurrenceStatus.PENDING,
        })
        .expect(200);

      const resetOccurrence = resetResponse.body as HabitOccurrenceResponseBody;

      expect(resetOccurrence.status).toBe(HabitOccurrenceStatus.PENDING);

      expect(resetOccurrence.resolvedDate).toBeNull();

      const skippedResponse = await request(httpServer)
        .patch(`/habit-occurrences/${occurrence.id}/status`)
        .send({
          status: HabitOccurrenceStatus.SKIPPED,
        })
        .expect(200);

      const skippedOccurrence =
        skippedResponse.body as HabitOccurrenceResponseBody;

      expect(skippedOccurrence.status).toBe(HabitOccurrenceStatus.SKIPPED);

      expect(skippedOccurrence.resolvedDate).toBe(today);

      const historyResponse = await request(httpServer)
        .get(`/habits/${habit.id}/occurrences`)
        .expect(200);

      const history = historyResponse.body as HabitOccurrenceResponseBody[];

      expect(history).toEqual([skippedOccurrence]);
    });

    it('rejects a direct change from completed to skipped', async () => {
      const today = getCurrentDateInTimeZone();

      const habit = habitRepository.create({
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        startDate: today,
        intervalDays: 2,
        weekdays: null,
        weeklyTarget: null,
        missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
        isActive: true,
      });

      const savedHabit = await habitRepository.save(habit);

      const occurrence = occurrenceRepository.create({
        habitId: savedHabit.id,
        scheduledDate: today,
        status: HabitOccurrenceStatus.COMPLETED,
        resolvedDate: today,
      });

      const savedOccurrence = await occurrenceRepository.save(occurrence);

      const response = await request(httpServer)
        .patch(`/habit-occurrences/${savedOccurrence.id}/status`)
        .send({
          status: HabitOccurrenceStatus.SKIPPED,
        })
        .expect(409);

      const body = response.body as ErrorResponseBody;

      expect(body.statusCode).toBe(409);

      expect(body.message).toBe(
        'Cannot change occurrence status from completed to skipped',
      );
    });
  });

  describe('validation and missing resources', () => {
    it('rejects an invalid status', async () => {
      const today = getCurrentDateInTimeZone();

      const habit = habitRepository.create({
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        startDate: today,
        intervalDays: 2,
        weekdays: null,
        weeklyTarget: null,
        missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
        isActive: true,
      });

      const savedHabit = await habitRepository.save(habit);

      const occurrence = occurrenceRepository.create({
        habitId: savedHabit.id,
        scheduledDate: today,
        status: HabitOccurrenceStatus.PENDING,
        resolvedDate: null,
      });

      const savedOccurrence = await occurrenceRepository.save(occurrence);

      const response = await request(httpServer)
        .patch(`/habit-occurrences/${savedOccurrence.id}/status`)
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
