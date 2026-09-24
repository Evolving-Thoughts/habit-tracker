import { Test, TestingModule } from '@nestjs/testing';
import { HabitEntity } from '../habits/entities/habit.entity';
import { HabitScheduleType } from '../habits/enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../habits/enums/missed-occurrence-policy.enum';
import { HabitOccurrenceEntity } from './entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from './enums/habit-occurrence-status.enum';
import { HabitOccurrenceGeneratorService } from './habit-occurrence-generator.service';
import { HabitOccurrencesController } from './habit-occurrences.controller';
import { HabitOccurrencesService } from './habit-occurrences.service';

type HabitOccurrencesServiceMock = {
  findByHabit: jest.MockedFunction<
    (habitId: number) => Promise<HabitOccurrenceEntity[]>
  >;

  updateStatus: jest.MockedFunction<
    (
      id: number,
      status: HabitOccurrenceStatus,
    ) => Promise<HabitOccurrenceEntity>
  >;
};

type HabitOccurrenceGeneratorServiceMock = {
  generateToday: jest.MockedFunction<() => Promise<HabitOccurrenceEntity[]>>;
};

describe('HabitOccurrencesController', () => {
  let controller: HabitOccurrencesController;
  let occurrenceServiceMock: HabitOccurrencesServiceMock;
  let generatorServiceMock: HabitOccurrenceGeneratorServiceMock;

  const habit: HabitEntity = {
    id: 1,
    title: 'Joggen',
    scheduleType: HabitScheduleType.INTERVAL,
    startDate: '2026-09-20',
    intervalDays: 2,
    weekdays: null,
    weeklyTarget: null,
    missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
    isActive: true,
    createdAt: new Date('2026-09-18T10:00:00.000Z'),
    updatedAt: new Date('2026-09-18T10:00:00.000Z'),
    deletedAt: null,
  };

  const occurrence: HabitOccurrenceEntity = {
    id: 1,
    habitId: habit.id,
    habit,
    scheduledDate: '2026-09-21',
    status: HabitOccurrenceStatus.PENDING,
    resolvedDate: null,
    createdAt: new Date('2026-09-21T08:00:00.000Z'),
    updatedAt: new Date('2026-09-21T08:00:00.000Z'),
  };

  beforeEach(async () => {
    occurrenceServiceMock = {
      findByHabit: jest.fn(),
      updateStatus: jest.fn(),
    };

    generatorServiceMock = {
      generateToday: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HabitOccurrencesController],
      providers: [
        {
          provide: HabitOccurrencesService,
          useValue: occurrenceServiceMock,
        },
        {
          provide: HabitOccurrenceGeneratorService,
          useValue: generatorServiceMock,
        },
      ],
    }).compile();

    controller = module.get(HabitOccurrencesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findToday', () => {
    it('generates and maps today occurrences', async () => {
      generatorServiceMock.generateToday.mockResolvedValue([occurrence]);

      await expect(controller.findToday()).resolves.toEqual([
        {
          id: 1,
          habitId: 1,
          scheduledDate: '2026-09-21',
          status: HabitOccurrenceStatus.PENDING,
          resolvedDate: null,
        },
      ]);

      expect(generatorServiceMock.generateToday).toHaveBeenCalledTimes(1);
    });

    it('returns an empty list when nothing is due today', async () => {
      generatorServiceMock.generateToday.mockResolvedValue([]);

      await expect(controller.findToday()).resolves.toEqual([]);

      expect(generatorServiceMock.generateToday).toHaveBeenCalledTimes(1);
    });
  });

  describe('findByHabit', () => {
    it('maps all occurrences to response DTOs', async () => {
      occurrenceServiceMock.findByHabit.mockResolvedValue([occurrence]);

      await expect(controller.findByHabit(habit.id)).resolves.toEqual([
        {
          id: 1,
          habitId: 1,
          scheduledDate: '2026-09-21',
          status: HabitOccurrenceStatus.PENDING,
          resolvedDate: null,
        },
      ]);

      expect(occurrenceServiceMock.findByHabit).toHaveBeenCalledWith(habit.id);
    });

    it('returns an empty list when the habit has no occurrences', async () => {
      occurrenceServiceMock.findByHabit.mockResolvedValue([]);

      await expect(controller.findByHabit(habit.id)).resolves.toEqual([]);

      expect(occurrenceServiceMock.findByHabit).toHaveBeenCalledWith(habit.id);
    });
  });

  describe('updateStatus', () => {
    it('completes an occurrence and maps the response', async () => {
      const completedOccurrence: HabitOccurrenceEntity = {
        ...occurrence,
        status: HabitOccurrenceStatus.COMPLETED,
        resolvedDate: '2026-09-21',
      };

      occurrenceServiceMock.updateStatus.mockResolvedValue(completedOccurrence);

      await expect(
        controller.updateStatus(occurrence.id, {
          status: HabitOccurrenceStatus.COMPLETED,
        }),
      ).resolves.toEqual({
        id: 1,
        habitId: 1,
        scheduledDate: '2026-09-21',
        status: HabitOccurrenceStatus.COMPLETED,
        resolvedDate: '2026-09-21',
      });

      expect(occurrenceServiceMock.updateStatus).toHaveBeenCalledWith(
        occurrence.id,
        HabitOccurrenceStatus.COMPLETED,
      );
    });

    it('skips an occurrence and maps the response', async () => {
      const skippedOccurrence: HabitOccurrenceEntity = {
        ...occurrence,
        status: HabitOccurrenceStatus.SKIPPED,
        resolvedDate: '2026-09-21',
      };

      occurrenceServiceMock.updateStatus.mockResolvedValue(skippedOccurrence);

      await expect(
        controller.updateStatus(occurrence.id, {
          status: HabitOccurrenceStatus.SKIPPED,
        }),
      ).resolves.toEqual({
        id: 1,
        habitId: 1,
        scheduledDate: '2026-09-21',
        status: HabitOccurrenceStatus.SKIPPED,
        resolvedDate: '2026-09-21',
      });

      expect(occurrenceServiceMock.updateStatus).toHaveBeenCalledWith(
        occurrence.id,
        HabitOccurrenceStatus.SKIPPED,
      );
    });

    it('resets an occurrence to pending', async () => {
      const resetOccurrence: HabitOccurrenceEntity = {
        ...occurrence,
        status: HabitOccurrenceStatus.PENDING,
        resolvedDate: null,
      };

      occurrenceServiceMock.updateStatus.mockResolvedValue(resetOccurrence);

      await expect(
        controller.updateStatus(occurrence.id, {
          status: HabitOccurrenceStatus.PENDING,
        }),
      ).resolves.toEqual({
        id: 1,
        habitId: 1,
        scheduledDate: '2026-09-21',
        status: HabitOccurrenceStatus.PENDING,
        resolvedDate: null,
      });

      expect(occurrenceServiceMock.updateStatus).toHaveBeenCalledWith(
        occurrence.id,
        HabitOccurrenceStatus.PENDING,
      );
    });
  });
});
