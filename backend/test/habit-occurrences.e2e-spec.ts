import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { getCurrentDateInTimeZone } from '../src/common/date/date-only.utils';
import { CreateHabitDto } from '../src/habits/dto/create-habit.dto';
import { HabitScheduleType } from '../src/habits/enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../src/habits/enums/missed-occurrence-policy.enum';
import { Weekday } from '../src/habits/enums/weekday.enum';
import { HabitOccurrenceEntity } from '../src/habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../src/habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitOccurrencesService } from '../src/habit-occurrences/habit-occurrences.service';
import { HabitScheduleCalculator } from '../src/habit-occurrences/scheduling/habit-schedule-calculator';
import { clearHabitTestData } from './helpers/clear-habit-test-data';

type OccurrenceBody = {
  id: number;
  habitId: number;
  scheduledDate: string;
  status: HabitOccurrenceStatus;
  resolvedDate: string | null;
};

describe('Habit occurrences API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let httpServer: Server;
  let repository: Repository<HabitOccurrenceEntity>;
  let service: HabitOccurrencesService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);

    await app.init();

    dataSource = app.get(DataSource);

    if (dataSource.options.database !== 'habit_tracker_test') {
      throw new Error('These tests require habit_tracker_test.');
    }

    httpServer = app.getHttpServer() as Server;
    repository = dataSource.getRepository(HabitOccurrenceEntity);
    service = app.get(HabitOccurrencesService);
  });

  beforeEach(async () => {
    await clearHabitTestData(dataSource);
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
        await clearHabitTestData(dataSource);
      }
    } finally {
      await app.close();
    }
  });

  async function createHabit(
    overrides: Partial<CreateHabitDto> = {},
  ): Promise<number> {
    const response = await request(httpServer)
      .post('/habits')
      .send({
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        startDate: getCurrentDateInTimeZone(),
        intervalDays: 2,
        missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
        ...overrides,
      })
      .expect(201);

    const body = response.body as { id: number };

    return body.id;
  }

  async function getToday(): Promise<OccurrenceBody[]> {
    const response = await request(httpServer)
      .get('/habit-occurrences/today')
      .expect(200);

    return response.body as OccurrenceBody[];
  }

  async function getHistory(habitId: number): Promise<OccurrenceBody[]> {
    const response = await request(httpServer)
      .get(`/habits/${habitId}/occurrences`)
      .expect(200);

    return response.body as OccurrenceBody[];
  }

  async function setStatus(
    id: number,
    status: HabitOccurrenceStatus,
  ): Promise<OccurrenceBody> {
    const response = await request(httpServer)
      .patch(`/habit-occurrences/${id}/status`)
      .send({ status })
      .expect(200);

    return response.body as OccurrenceBody;
  }

  describe('GET /habit-occurrences/today', () => {
    it('generates one due interval occurrence and does not duplicate it', async () => {
      const today = getCurrentDateInTimeZone();
      const habitId = await createHabit();

      const first = await getToday();
      const second = await getToday();

      expect(first).toHaveLength(1);

      expect(first[0]).toMatchObject({
        habitId,
        scheduledDate: today,
        status: HabitOccurrenceStatus.PENDING,
        resolvedDate: null,
      });

      expect(second).toEqual(first);
      expect(await repository.count()).toBe(1);
    });

    it('keeps an interval occurrence inside its carry-over window', async () => {
      const today = getCurrentDateInTimeZone();
      const yesterday = HabitScheduleCalculator.addDays(today, -1);

      const habitId = await createHabit({
        startDate: yesterday,
      });

      const occurrences = await getToday();

      expect(occurrences).toHaveLength(1);

      expect(occurrences[0]).toMatchObject({
        habitId,
        scheduledDate: yesterday,
        status: HabitOccurrenceStatus.PENDING,
      });
    });

    it('backfills expired intervals as skipped without displaying them today', async () => {
      const today = getCurrentDateInTimeZone();
      const fourDaysAgo = HabitScheduleCalculator.addDays(today, -4);
      const twoDaysAgo = HabitScheduleCalculator.addDays(today, -2);

      const habitId = await createHabit({
        startDate: fourDaysAgo,
      });

      const occurrences = await getToday();

      expect(occurrences).toHaveLength(1);

      expect(occurrences[0]).toMatchObject({
        habitId,
        scheduledDate: today,
        status: HabitOccurrenceStatus.PENDING,
      });

      const history = await getHistory(habitId);

      expect(history.map((item) => [item.scheduledDate, item.status])).toEqual([
        [fourDaysAgo, HabitOccurrenceStatus.SKIPPED],
        [twoDaysAgo, HabitOccurrenceStatus.SKIPPED],
        [today, HabitOccurrenceStatus.PENDING],
      ]);
    });

    it('expires SKIP occurrences after their scheduled day', async () => {
      const today = getCurrentDateInTimeZone();
      const yesterday = HabitScheduleCalculator.addDays(today, -1);

      const habitId = await createHabit({
        startDate: yesterday,
        missedOccurrencePolicy: MissedOccurrencePolicy.SKIP,
      });

      expect(await getToday()).toEqual([]);

      const history = await getHistory(habitId);

      expect(history).toHaveLength(1);

      expect(history[0]).toMatchObject({
        scheduledDate: yesterday,
        status: HabitOccurrenceStatus.SKIPPED,
      });
    });

    it('does not generate occurrences before the habit start date', async () => {
      const tomorrow = HabitScheduleCalculator.addDays(
        getCurrentDateInTimeZone(),
        1,
      );

      await createHabit({
        startDate: tomorrow,
      });

      expect(await getToday()).toEqual([]);
      expect(await repository.count()).toBe(0);
    });

    it('excludes inactive and soft-deleted habits', async () => {
      const pausedId = await createHabit();

      const deletedId = await createHabit({
        title: 'Gitarre',
      });

      await request(httpServer)
        .patch(`/habits/${pausedId}`)
        .send({ isActive: false })
        .expect(200);

      await request(httpServer).delete(`/habits/${deletedId}`).expect(204);

      expect(await getToday()).toEqual([]);
      expect(await repository.count()).toBe(0);
    });

    it('generates a fixed-weekday occurrence on a configured weekday', async () => {
      const today = getCurrentDateInTimeZone();

      // JavaScripts getUTCDay() verwendet Sonntag = 0.
      // Das ist nur die Umrechnung, nicht unser Wochenbeginn.
      const weekdays = [
        Weekday.SUNDAY,
        Weekday.MONDAY,
        Weekday.TUESDAY,
        Weekday.WEDNESDAY,
        Weekday.THURSDAY,
        Weekday.FRIDAY,
        Weekday.SATURDAY,
      ];

      const weekday = weekdays[new Date(`${today}T12:00:00Z`).getUTCDay()];

      if (!weekday) {
        throw new Error('Could not determine weekday');
      }

      const habitId = await createHabit({
        scheduleType: HabitScheduleType.FIXED_WEEKDAYS,
        intervalDays: undefined,
        weekdays: [weekday],
      });

      const occurrences = await getToday();

      expect(occurrences).toHaveLength(1);

      expect(occurrences[0]).toMatchObject({
        habitId,
        scheduledDate: today,
      });
    });

    it('does not create another weekly-target chance after reaching the target', async () => {
      const habitId = await createHabit({
        scheduleType: HabitScheduleType.WEEKLY_TARGET,
        intervalDays: undefined,
        weeklyTarget: 1,
      });

      const initial = await getToday();

      expect(initial).toHaveLength(1);

      const occurrence = initial[0];

      if (!occurrence) {
        throw new Error('Expected a pending weekly-target occurrence');
      }

      await setStatus(occurrence.id, HabitOccurrenceStatus.COMPLETED);

      const afterCompletion = await getToday();

      expect(afterCompletion).toHaveLength(1);

      expect(afterCompletion[0]).toMatchObject({
        habitId,
        status: HabitOccurrenceStatus.COMPLETED,
      });

      expect(await repository.count()).toBe(1);
    });
  });

  describe('GET /habits/:habitId/occurrences', () => {
    it('returns history ordered by scheduled date', async () => {
      const habitId = await createHabit({
        startDate: '2026-01-01',
      });

      // Direkte Test-Fixtures zur Prüfung der Sortierung.
      // Dieser Test ruft den Generator absichtlich nicht auf.
      await service.createPendingOccurrence(habitId, '2026-01-05');
      await service.createPendingOccurrence(habitId, '2026-01-01');
      await service.createPendingOccurrence(habitId, '2026-01-03');

      const history = await getHistory(habitId);

      expect(history.map((item) => item.scheduledDate)).toEqual([
        '2026-01-01',
        '2026-01-03',
        '2026-01-05',
      ]);
    });

    it('returns 404 for a missing habit', async () => {
      await request(httpServer)
        .get('/habits/2147483647/occurrences')
        .expect(404);
    });

    it('returns 400 for a non-numeric habit ID', async () => {
      await request(httpServer)
        .get('/habits/not-a-number/occurrences')
        .expect(400);
    });
  });

  describe('PATCH /habit-occurrences/:id/status', () => {
    it.each([HabitOccurrenceStatus.COMPLETED, HabitOccurrenceStatus.SKIPPED])(
      'resolves a pending occurrence as %s and allows reopening',
      async (status) => {
        const today = getCurrentDateInTimeZone();
        const habitId = await createHabit();

        const occurrence = await service.createPendingOccurrence(
          habitId,
          today,
        );

        const resolved = await setStatus(occurrence.id, status);

        expect(resolved.status).toBe(status);
        expect(resolved.resolvedDate).toBe(today);

        const reopened = await setStatus(
          occurrence.id,
          HabitOccurrenceStatus.PENDING,
        );

        expect(reopened.status).toBe(HabitOccurrenceStatus.PENDING);
        expect(reopened.resolvedDate).toBeNull();
      },
    );

    it('does not change timestamps when the same status is submitted again', async () => {
      const habitId = await createHabit();

      const occurrence = await service.createPendingOccurrence(
        habitId,
        getCurrentDateInTimeZone(),
      );

      const first = await setStatus(
        occurrence.id,
        HabitOccurrenceStatus.COMPLETED,
      );

      const before = await repository.findOneByOrFail({
        id: occurrence.id,
      });

      const second = await setStatus(
        occurrence.id,
        HabitOccurrenceStatus.COMPLETED,
      );

      const after = await repository.findOneByOrFail({
        id: occurrence.id,
      });

      expect(second).toEqual(first);
      expect(after.updatedAt).toEqual(before.updatedAt);
    });

    it.each([
      [HabitOccurrenceStatus.COMPLETED, HabitOccurrenceStatus.SKIPPED],
      [HabitOccurrenceStatus.SKIPPED, HabitOccurrenceStatus.COMPLETED],
    ])('rejects the direct transition from %s to %s', async (from, to) => {
      const habitId = await createHabit();

      const occurrence = await service.createPendingOccurrence(
        habitId,
        getCurrentDateInTimeZone(),
      );

      await setStatus(occurrence.id, from);

      await request(httpServer)
        .patch(`/habit-occurrences/${occurrence.id}/status`)
        .send({ status: to })
        .expect(409);

      const persisted = await repository.findOneByOrFail({
        id: occurrence.id,
      });

      expect(persisted.status).toBe(from);
    });

    it('rejects invalid status values', async () => {
      const habitId = await createHabit();

      const occurrence = await service.createPendingOccurrence(
        habitId,
        getCurrentDateInTimeZone(),
      );

      await request(httpServer)
        .patch(`/habit-occurrences/${occurrence.id}/status`)
        .send({ status: 'invalid' })
        .expect(400);
    });

    it('returns 404 for a missing occurrence', async () => {
      await request(httpServer)
        .patch('/habit-occurrences/2147483647/status')
        .send({ status: HabitOccurrenceStatus.COMPLETED })
        .expect(404);
    });

    it('returns 400 for a non-numeric occurrence ID', async () => {
      await request(httpServer)
        .patch('/habit-occurrences/not-a-number/status')
        .send({ status: HabitOccurrenceStatus.COMPLETED })
        .expect(400);
    });
  });
});
