import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HabitEntity } from '../habits/entities/habit.entity';
import { HabitScheduleType } from '../habits/enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../habits/enums/missed-occurrence-policy.enum';
import { HabitOccurrenceEntity } from './entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from './enums/habit-occurrence-status.enum';
import { HabitOccurrencesService } from './habit-occurrences.service';

type OccurrenceRepositoryMock = jest.Mocked<
  Pick<
    Repository<HabitOccurrenceEntity>,
    'find' | 'findOneBy' | 'create' | 'save'
  >
>;

type HabitRepositoryMock = jest.Mocked<
  Pick<Repository<HabitEntity>, 'findOneBy'>
>;

describe('HabitOccurrencesService', () => {
  let service: HabitOccurrencesService;
  let occurrenceRepository: OccurrenceRepositoryMock;
  let habitRepository: HabitRepositoryMock;

  const activeHabit: HabitEntity = {
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
    habitId: activeHabit.id,
    habit: activeHabit,
    scheduledDate: '2026-09-21',
    status: HabitOccurrenceStatus.PENDING,
    resolvedDate: null,
    createdAt: new Date('2026-09-21T08:00:00.000Z'),
    updatedAt: new Date('2026-09-21T08:00:00.000Z'),
  };

  beforeEach(async () => {
    occurrenceRepository = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    habitRepository = {
      findOneBy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HabitOccurrencesService,
        {
          provide: getRepositoryToken(HabitOccurrenceEntity),
          useValue: occurrenceRepository,
        },
        {
          provide: getRepositoryToken(HabitEntity),
          useValue: habitRepository,
        },
      ],
    }).compile();

    service = module.get(HabitOccurrencesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPendingOccurrence', () => {
    it('creates a pending occurrence', async () => {
      habitRepository.findOneBy.mockResolvedValue(activeHabit);

      occurrenceRepository.findOneBy.mockResolvedValue(null);

      const unsavedOccurrence = {
        habitId: activeHabit.id,
        scheduledDate: '2026-09-21',
        status: HabitOccurrenceStatus.PENDING,
        resolvedDate: null,
      } as HabitOccurrenceEntity;

      occurrenceRepository.create.mockReturnValue(unsavedOccurrence);

      occurrenceRepository.save.mockResolvedValue(occurrence);

      await expect(
        service.createPendingOccurrence(activeHabit.id, '2026-09-21'),
      ).resolves.toEqual(occurrence);

      expect(habitRepository.findOneBy).toHaveBeenCalledWith({
        id: activeHabit.id,
      });

      expect(occurrenceRepository.findOneBy).toHaveBeenCalledWith({
        habitId: activeHabit.id,
        scheduledDate: '2026-09-21',
      });

      expect(occurrenceRepository.create).toHaveBeenCalledWith({
        habitId: activeHabit.id,
        scheduledDate: '2026-09-21',
        status: HabitOccurrenceStatus.PENDING,
        resolvedDate: null,
      });

      expect(occurrenceRepository.save).toHaveBeenCalledWith(unsavedOccurrence);
    });

    it('returns an existing occurrence for the same day', async () => {
      habitRepository.findOneBy.mockResolvedValue(activeHabit);

      occurrenceRepository.findOneBy.mockResolvedValue(occurrence);

      await expect(
        service.createPendingOccurrence(activeHabit.id, '2026-09-21'),
      ).resolves.toEqual(occurrence);

      expect(occurrenceRepository.create).not.toHaveBeenCalled();

      expect(occurrenceRepository.save).not.toHaveBeenCalled();
    });

    it('throws when the habit does not exist', async () => {
      habitRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.createPendingOccurrence(999, '2026-09-21'),
      ).rejects.toThrow(NotFoundException);

      expect(occurrenceRepository.findOneBy).not.toHaveBeenCalled();

      expect(occurrenceRepository.create).not.toHaveBeenCalled();

      expect(occurrenceRepository.save).not.toHaveBeenCalled();
    });

    it('rejects creating an occurrence for an inactive habit', async () => {
      habitRepository.findOneBy.mockResolvedValue({
        ...activeHabit,
        isActive: false,
      });

      await expect(
        service.createPendingOccurrence(activeHabit.id, '2026-09-21'),
      ).rejects.toThrow(BadRequestException);

      expect(occurrenceRepository.findOneBy).not.toHaveBeenCalled();

      expect(occurrenceRepository.create).not.toHaveBeenCalled();

      expect(occurrenceRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findByHabit', () => {
    it('returns all occurrences for a habit', async () => {
      habitRepository.findOneBy.mockResolvedValue(activeHabit);

      occurrenceRepository.find.mockResolvedValue([occurrence]);

      await expect(service.findByHabit(activeHabit.id)).resolves.toEqual([
        occurrence,
      ]);

      expect(habitRepository.findOneBy).toHaveBeenCalledWith({
        id: activeHabit.id,
      });

      expect(occurrenceRepository.find).toHaveBeenCalledWith({
        where: {
          habitId: activeHabit.id,
        },
        order: {
          scheduledDate: 'ASC',
          id: 'ASC',
        },
      });
    });

    it('throws when the habit does not exist', async () => {
      habitRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findByHabit(999)).rejects.toThrow(NotFoundException);

      expect(occurrenceRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns an occurrence', async () => {
      occurrenceRepository.findOneBy.mockResolvedValue(occurrence);

      await expect(service.findOne(1)).resolves.toEqual(occurrence);

      expect(occurrenceRepository.findOneBy).toHaveBeenCalledWith({
        id: 1,
      });
    });

    it('throws when the occurrence does not exist', async () => {
      occurrenceRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('completes a pending occurrence', async () => {
      jest.useFakeTimers();

      jest.setSystemTime(new Date('2026-09-21T10:00:00.000Z'));

      const pendingOccurrence: HabitOccurrenceEntity = {
        ...occurrence,
      };

      const completedOccurrence: HabitOccurrenceEntity = {
        ...occurrence,
        status: HabitOccurrenceStatus.COMPLETED,
        resolvedDate: '2026-09-21',
      };

      occurrenceRepository.findOneBy.mockResolvedValue(pendingOccurrence);

      occurrenceRepository.save.mockResolvedValue(completedOccurrence);

      await expect(
        service.updateStatus(occurrence.id, HabitOccurrenceStatus.COMPLETED),
      ).resolves.toEqual(completedOccurrence);

      expect(occurrenceRepository.save).toHaveBeenCalledWith({
        ...pendingOccurrence,
        status: HabitOccurrenceStatus.COMPLETED,
        resolvedDate: '2026-09-21',
      });
    });

    it('skips a pending occurrence', async () => {
      jest.useFakeTimers();

      jest.setSystemTime(new Date('2026-09-21T10:00:00.000Z'));

      const pendingOccurrence: HabitOccurrenceEntity = {
        ...occurrence,
      };

      const skippedOccurrence: HabitOccurrenceEntity = {
        ...occurrence,
        status: HabitOccurrenceStatus.SKIPPED,
        resolvedDate: '2026-09-21',
      };

      occurrenceRepository.findOneBy.mockResolvedValue(pendingOccurrence);

      occurrenceRepository.save.mockResolvedValue(skippedOccurrence);

      await expect(
        service.updateStatus(occurrence.id, HabitOccurrenceStatus.SKIPPED),
      ).resolves.toEqual(skippedOccurrence);

      expect(occurrenceRepository.save).toHaveBeenCalledWith({
        ...pendingOccurrence,
        status: HabitOccurrenceStatus.SKIPPED,
        resolvedDate: '2026-09-21',
      });
    });

    it('resets a completed occurrence to pending', async () => {
      const completedOccurrence: HabitOccurrenceEntity = {
        ...occurrence,
        status: HabitOccurrenceStatus.COMPLETED,
        resolvedDate: '2026-09-21',
      };

      const resetOccurrence: HabitOccurrenceEntity = {
        ...occurrence,
        status: HabitOccurrenceStatus.PENDING,
        resolvedDate: null,
      };

      occurrenceRepository.findOneBy.mockResolvedValue(completedOccurrence);

      occurrenceRepository.save.mockResolvedValue(resetOccurrence);

      await expect(
        service.updateStatus(occurrence.id, HabitOccurrenceStatus.PENDING),
      ).resolves.toEqual(resetOccurrence);

      expect(occurrenceRepository.save).toHaveBeenCalledWith({
        ...completedOccurrence,
        status: HabitOccurrenceStatus.PENDING,
        resolvedDate: null,
      });
    });

    it('resets a skipped occurrence to pending', async () => {
      const skippedOccurrence: HabitOccurrenceEntity = {
        ...occurrence,
        status: HabitOccurrenceStatus.SKIPPED,
        resolvedDate: '2026-09-21',
      };

      const resetOccurrence: HabitOccurrenceEntity = {
        ...occurrence,
        status: HabitOccurrenceStatus.PENDING,
        resolvedDate: null,
      };

      occurrenceRepository.findOneBy.mockResolvedValue(skippedOccurrence);

      occurrenceRepository.save.mockResolvedValue(resetOccurrence);

      await expect(
        service.updateStatus(occurrence.id, HabitOccurrenceStatus.PENDING),
      ).resolves.toEqual(resetOccurrence);

      expect(occurrenceRepository.save).toHaveBeenCalledWith({
        ...skippedOccurrence,
        status: HabitOccurrenceStatus.PENDING,
        resolvedDate: null,
      });
    });

    it('returns the occurrence when the status is unchanged', async () => {
      const pendingOccurrence: HabitOccurrenceEntity = {
        ...occurrence,
      };

      occurrenceRepository.findOneBy.mockResolvedValue(pendingOccurrence);

      await expect(
        service.updateStatus(occurrence.id, HabitOccurrenceStatus.PENDING),
      ).resolves.toEqual(pendingOccurrence);

      expect(occurrenceRepository.save).not.toHaveBeenCalled();
    });

    it('rejects changing completed directly to skipped', async () => {
      const completedOccurrence: HabitOccurrenceEntity = {
        ...occurrence,
        status: HabitOccurrenceStatus.COMPLETED,
        resolvedDate: '2026-09-21',
      };

      occurrenceRepository.findOneBy.mockResolvedValue(completedOccurrence);

      await expect(
        service.updateStatus(occurrence.id, HabitOccurrenceStatus.SKIPPED),
      ).rejects.toThrow(ConflictException);

      expect(occurrenceRepository.save).not.toHaveBeenCalled();
    });

    it('rejects changing skipped directly to completed', async () => {
      const skippedOccurrence: HabitOccurrenceEntity = {
        ...occurrence,
        status: HabitOccurrenceStatus.SKIPPED,
        resolvedDate: '2026-09-21',
      };

      occurrenceRepository.findOneBy.mockResolvedValue(skippedOccurrence);

      await expect(
        service.updateStatus(occurrence.id, HabitOccurrenceStatus.COMPLETED),
      ).rejects.toThrow(ConflictException);

      expect(occurrenceRepository.save).not.toHaveBeenCalled();
    });

    it('throws when the occurrence does not exist', async () => {
      occurrenceRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.updateStatus(999, HabitOccurrenceStatus.COMPLETED),
      ).rejects.toThrow(NotFoundException);

      expect(occurrenceRepository.save).not.toHaveBeenCalled();
    });
  });
});
