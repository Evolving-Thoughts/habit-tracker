import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Server } from 'node:http';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { HabitEntity } from '../src/habits/entities/habit.entity';
import { HabitScheduleType } from '../src/habits/enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../src/habits/enums/missed-occurrence-policy.enum';
import { Weekday } from '../src/habits/enums/weekday.enum';

type HabitResponseBody = {
  id: number;
  title: string;
  scheduleType: HabitScheduleType;
  startDate: string;
  intervalDays: number | null;
  weekdays: Weekday[] | null;
  weeklyTarget: number | null;
  missedOccurrencePolicy: MissedOccurrencePolicy;
  isActive: boolean;
};

type ErrorResponseBody = {
  statusCode: number;
  message: string | string[];
  error: string;
};

function getCurrentDateInTimeZone(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((part) => part.type === 'year')?.value;

  const month = parts.find((part) => part.type === 'month')?.value;

  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Could not determine the current date');
  }

  return `${year}-${month}-${day}`;
}

describe('Habits API (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let habitRepository: Repository<HabitEntity>;

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
  });

  beforeEach(async () => {
    await habitRepository.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /habits', () => {
    it('creates an interval habit with the current date', async () => {
      const response = await request(httpServer)
        .post('/habits')
        .send({
          title: 'Joggen',
          scheduleType: HabitScheduleType.INTERVAL,
          intervalDays: 2,
        })
        .expect(201);

      const body = response.body as HabitResponseBody;

      expect(typeof body.id).toBe('number');

      expect(body).toEqual({
        id: body.id,
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        startDate: getCurrentDateInTimeZone('Europe/Berlin'),
        intervalDays: 2,
        weekdays: null,
        weeklyTarget: null,
        missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
        isActive: true,
      });

      const persistedHabit = await habitRepository.findOneBy({
        id: body.id,
      });

      expect(persistedHabit).not.toBeNull();
      expect(persistedHabit?.title).toBe('Joggen');
      expect(persistedHabit?.intervalDays).toBe(2);
      expect(persistedHabit?.deletedAt).toBeNull();
    });

    it('creates a habit with fixed weekdays', async () => {
      const response = await request(httpServer)
        .post('/habits')
        .send({
          title: 'Putzen',
          scheduleType: HabitScheduleType.FIXED_WEEKDAYS,
          startDate: '2026-09-20',
          weekdays: [Weekday.WEDNESDAY, Weekday.SATURDAY],
        })
        .expect(201);

      const body = response.body as HabitResponseBody;

      expect(body.scheduleType).toBe(HabitScheduleType.FIXED_WEEKDAYS);

      expect(body.startDate).toBe('2026-09-20');

      expect(body.weekdays).toEqual([Weekday.WEDNESDAY, Weekday.SATURDAY]);

      expect(body.intervalDays).toBeNull();
      expect(body.weeklyTarget).toBeNull();
    });

    it('creates a weekly-target habit', async () => {
      const response = await request(httpServer)
        .post('/habits')
        .send({
          title: 'Gitarre spielen',
          scheduleType: HabitScheduleType.WEEKLY_TARGET,
          startDate: '2026-09-20',
          weeklyTarget: 3,
          missedOccurrencePolicy: MissedOccurrencePolicy.SKIP,
        })
        .expect(201);

      const body = response.body as HabitResponseBody;

      expect(body.scheduleType).toBe(HabitScheduleType.WEEKLY_TARGET);
      expect(body.weeklyTarget).toBe(3);
      expect(body.missedOccurrencePolicy).toBe(MissedOccurrencePolicy.SKIP);
      expect(body.intervalDays).toBeNull();
      expect(body.weekdays).toBeNull();
    });

    it('rejects fields from another schedule type', async () => {
      const response = await request(httpServer)
        .post('/habits')
        .send({
          title: 'Invalid habit',
          scheduleType: HabitScheduleType.INTERVAL,
          intervalDays: 2,
          weekdays: [Weekday.MONDAY],
        })
        .expect(400);

      const body = response.body as ErrorResponseBody;

      expect(body.statusCode).toBe(400);
      expect(body.message).toBe('An interval habit only accepts intervalDays');

      expect(await habitRepository.count()).toBe(0);
    });

    it('rejects duplicate weekdays', async () => {
      const response = await request(httpServer)
        .post('/habits')
        .send({
          title: 'Putzen',
          scheduleType: HabitScheduleType.FIXED_WEEKDAYS,
          weekdays: [Weekday.MONDAY, Weekday.MONDAY],
        })
        .expect(400);

      const body = response.body as ErrorResponseBody;

      expect(body.statusCode).toBe(400);

      expect(body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('must be unique')]),
      );

      expect(await habitRepository.count()).toBe(0);
    });

    it('rejects unknown properties', async () => {
      const response = await request(httpServer)
        .post('/habits')
        .send({
          title: 'Joggen',
          scheduleType: HabitScheduleType.INTERVAL,
          intervalDays: 2,
          unknownProperty: true,
        })
        .expect(400);

      const body = response.body as ErrorResponseBody;

      expect(body.statusCode).toBe(400);
      expect(body.message).toContain(
        'property unknownProperty should not exist',
      );
    });
  });

  describe('Habit CRUD flow', () => {
    it('creates, reads, updates and soft-deletes a habit', async () => {
      const createResponse = await request(httpServer)
        .post('/habits')
        .send({
          title: 'Joggen',
          scheduleType: HabitScheduleType.INTERVAL,
          startDate: '2026-09-20',
          intervalDays: 2,
        })
        .expect(201);

      const createdHabit = createResponse.body as HabitResponseBody;

      const getResponse = await request(httpServer)
        .get(`/habits/${createdHabit.id}`)
        .expect(200);

      const foundHabit = getResponse.body as HabitResponseBody;

      expect(foundHabit).toEqual(createdHabit);

      const listResponse = await request(httpServer).get('/habits').expect(200);

      const listedHabits = listResponse.body as HabitResponseBody[];

      expect(listedHabits).toEqual([createdHabit]);

      const pauseResponse = await request(httpServer)
        .patch(`/habits/${createdHabit.id}`)
        .send({
          title: 'Morning run',
          isActive: false,
        })
        .expect(200);

      const pausedHabit = pauseResponse.body as HabitResponseBody;

      expect(pausedHabit).toEqual({
        ...createdHabit,
        title: 'Morning run',
        isActive: false,
      });

      const fixedWeekdayResponse = await request(httpServer)
        .patch(`/habits/${createdHabit.id}`)
        .send({
          scheduleType: HabitScheduleType.FIXED_WEEKDAYS,
          intervalDays: null,
          weekdays: [Weekday.MONDAY, Weekday.THURSDAY],
        })
        .expect(200);

      const fixedWeekdayHabit = fixedWeekdayResponse.body as HabitResponseBody;

      expect(fixedWeekdayHabit.scheduleType).toBe(
        HabitScheduleType.FIXED_WEEKDAYS,
      );
      expect(fixedWeekdayHabit.intervalDays).toBeNull();

      expect(fixedWeekdayHabit.weekdays).toEqual([
        Weekday.MONDAY,
        Weekday.THURSDAY,
      ]);

      const invalidChangeResponse = await request(httpServer)
        .patch(`/habits/${createdHabit.id}`)
        .send({
          scheduleType: HabitScheduleType.WEEKLY_TARGET,
          weeklyTarget: 3,
        })
        .expect(400);

      const invalidChangeBody = invalidChangeResponse.body as ErrorResponseBody;

      expect(invalidChangeBody.message).toBe(
        'A weekly-target habit only accepts weeklyTarget',
      );

      const weeklyTargetResponse = await request(httpServer)
        .patch(`/habits/${createdHabit.id}`)
        .send({
          scheduleType: HabitScheduleType.WEEKLY_TARGET,
          weekdays: null,
          weeklyTarget: 3,
        })
        .expect(200);

      const weeklyTargetHabit = weeklyTargetResponse.body as HabitResponseBody;

      expect(weeklyTargetHabit.scheduleType).toBe(
        HabitScheduleType.WEEKLY_TARGET,
      );
      expect(weeklyTargetHabit.intervalDays).toBeNull();
      expect(weeklyTargetHabit.weekdays).toBeNull();
      expect(weeklyTargetHabit.weeklyTarget).toBe(3);

      await request(httpServer)
        .delete(`/habits/${createdHabit.id}`)
        .expect(204)
        .expect('');

      await request(httpServer).get(`/habits/${createdHabit.id}`).expect(404);

      const listAfterDeletionResponse = await request(httpServer)
        .get('/habits')
        .expect(200);

      const habitsAfterDeletion =
        listAfterDeletionResponse.body as HabitResponseBody[];

      expect(habitsAfterDeletion).toEqual([]);

      const softDeletedHabit = await habitRepository.findOne({
        where: {
          id: createdHabit.id,
        },
        withDeleted: true,
      });

      expect(softDeletedHabit).not.toBeNull();
      expect(softDeletedHabit?.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('PATCH /habits/:id', () => {
    it('rejects an empty update', async () => {
      const habit = habitRepository.create({
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        startDate: '2026-09-20',
        intervalDays: 2,
        weekdays: null,
        weeklyTarget: null,
        missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
        isActive: true,
      });

      const savedHabit = await habitRepository.save(habit);

      const response = await request(httpServer)
        .patch(`/habits/${savedHabit.id}`)
        .send({})
        .expect(400);

      const body = response.body as ErrorResponseBody;

      expect(body.statusCode).toBe(400);
      expect(body.message).toBe('At least one property must be provided');
    });

    it('allows false and null as explicit updates', async () => {
      const habit = habitRepository.create({
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        startDate: '2026-09-20',
        intervalDays: 2,
        weekdays: null,
        weeklyTarget: null,
        missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
        isActive: true,
      });

      const savedHabit = await habitRepository.save(habit);

      const response = await request(httpServer)
        .patch(`/habits/${savedHabit.id}`)
        .send({
          scheduleType: HabitScheduleType.WEEKLY_TARGET,
          intervalDays: null,
          weeklyTarget: 3,
          isActive: false,
        })
        .expect(200);

      const body = response.body as HabitResponseBody;

      expect(body.scheduleType).toBe(HabitScheduleType.WEEKLY_TARGET);
      expect(body.intervalDays).toBeNull();
      expect(body.weeklyTarget).toBe(3);
      expect(body.isActive).toBe(false);
    });
  });

  describe('GET /habits/:id', () => {
    it('returns 400 for a non-numeric ID', async () => {
      const response = await request(httpServer)
        .get('/habits/not-a-number')
        .expect(400);

      const body = response.body as ErrorResponseBody;

      expect(body.statusCode).toBe(400);
    });

    it('returns 404 for a missing habit', async () => {
      const response = await request(httpServer)
        .get('/habits/999999')
        .expect(404);

      const body = response.body as ErrorResponseBody;

      expect(body.statusCode).toBe(404);
      expect(body.message).toBe('Habit with ID 999999 was not found');
    });
  });
});
