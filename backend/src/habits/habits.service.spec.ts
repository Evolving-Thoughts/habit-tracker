import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HabitEntity } from './entities/habit.entity';
import { HabitScheduleType } from './enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from './enums/missed-occurrence-policy.enum';
import { Weekday } from './enums/weekday.enum';
import { HabitsService } from './habits.service';

type HabitRepositoryMock = jest.Mocked<
  Pick<
    Repository<HabitEntity>,
    'find' | 'findOneBy' | 'create' | 'save' | 'preload' | 'softRemove'
  >
>;

describe('HabitsService', () => {
  let service: HabitsService;
  let repository: HabitRepositoryMock;

  const intervalHabit: HabitEntity = {
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

  beforeEach(async () => {
    repository = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      preload: jest.fn(),
      softRemove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HabitsService,
        {
          provide: getRepositoryToken(HabitEntity),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(HabitsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns all habits', async () => {
    repository.find.mockResolvedValue([intervalHabit]);

    await expect(service.findAll()).resolves.toEqual([intervalHabit]);

    expect(repository.find).toHaveBeenCalledWith({
      order: {
        id: 'ASC',
      },
    });
  });

  it('creates an interval habit', async () => {
    const unsavedHabit = {
      title: 'Joggen',
      scheduleType: HabitScheduleType.INTERVAL,
      startDate: '2026-09-20',
      intervalDays: 2,
      weekdays: null,
      weeklyTarget: null,
      missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
      isActive: true,
    } as HabitEntity;

    repository.create.mockReturnValue(unsavedHabit);
    repository.save.mockResolvedValue(intervalHabit);

    await expect(
      service.create({
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        startDate: '2026-09-20',
        intervalDays: 2,
      }),
    ).resolves.toEqual(intervalHabit);

    expect(repository.create).toHaveBeenCalledWith({
      title: 'Joggen',
      scheduleType: HabitScheduleType.INTERVAL,
      startDate: '2026-09-20',
      intervalDays: 2,
      weekdays: null,
      weeklyTarget: null,
      missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
      isActive: true,
    });
  });

  it('rejects an interval habit without intervalDays', async () => {
    await expect(
      service.create({
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        startDate: '2026-09-20',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rejects fields belonging to another schedule type', async () => {
    await expect(
      service.create({
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        startDate: '2026-09-20',
        intervalDays: 2,
        weekdays: [Weekday.MONDAY],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('uses the current local date when startDate is omitted', async () => {
    jest.useFakeTimers();

    jest.setSystemTime(new Date('2026-09-18T22:30:00.000Z'));

    const expectedHabit = {
      ...intervalHabit,
      startDate: '2026-09-19',
    };

    const unsavedHabit = {
      title: 'Joggen',
      scheduleType: HabitScheduleType.INTERVAL,
      startDate: '2026-09-19',
      intervalDays: 2,
      weekdays: null,
      weeklyTarget: null,
      missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
      isActive: true,
    } as HabitEntity;

    repository.create.mockReturnValue(unsavedHabit);
    repository.save.mockResolvedValue(expectedHabit);

    await expect(
      service.create({
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        intervalDays: 2,
      }),
    ).resolves.toEqual(expectedHabit);

    expect(repository.create).toHaveBeenCalledWith({
      title: 'Joggen',
      scheduleType: HabitScheduleType.INTERVAL,
      startDate: '2026-09-19',
      intervalDays: 2,
      weekdays: null,
      weeklyTarget: null,
      missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
      isActive: true,
    });

    jest.useRealTimers();
  });

  it('returns one habit', async () => {
    repository.findOneBy.mockResolvedValue(intervalHabit);

    await expect(service.findOne(1)).resolves.toEqual(intervalHabit);

    expect(repository.findOneBy).toHaveBeenCalledWith({
      id: 1,
    });
  });

  it('throws when a habit does not exist', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('pauses a habit', async () => {
    const pausedHabit: HabitEntity = {
      ...intervalHabit,
      isActive: false,
    };

    repository.preload.mockResolvedValue(pausedHabit);
    repository.save.mockResolvedValue(pausedHabit);

    await expect(
      service.update(1, {
        isActive: false,
      }),
    ).resolves.toEqual(pausedHabit);

    expect(repository.preload).toHaveBeenCalledWith({
      id: 1,
      isActive: false,
    });
  });

  it('changes an interval habit to fixed weekdays', async () => {
    const updatedHabit: HabitEntity = {
      ...intervalHabit,
      scheduleType: HabitScheduleType.FIXED_WEEKDAYS,
      intervalDays: null,
      weekdays: [Weekday.MONDAY, Weekday.THURSDAY],
    };

    repository.preload.mockResolvedValue(updatedHabit);
    repository.save.mockResolvedValue(updatedHabit);

    await expect(
      service.update(1, {
        scheduleType: HabitScheduleType.FIXED_WEEKDAYS,
        intervalDays: null,
        weekdays: [Weekday.MONDAY, Weekday.THURSDAY],
      }),
    ).resolves.toEqual(updatedHabit);

    expect(repository.save).toHaveBeenCalledWith(updatedHabit);
  });

  it('rejects a schedule change with incompatible fields', async () => {
    repository.preload.mockResolvedValue({
      ...intervalHabit,
      scheduleType: HabitScheduleType.FIXED_WEEKDAYS,
      weekdays: [Weekday.MONDAY],
      intervalDays: 2,
    });

    await expect(
      service.update(1, {
        scheduleType: HabitScheduleType.FIXED_WEEKDAYS,
        weekdays: [Weekday.MONDAY],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rejects an empty update', async () => {
    await expect(service.update(1, {})).rejects.toThrow(BadRequestException);

    expect(repository.preload).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('soft-deletes an existing habit', async () => {
    repository.findOneBy.mockResolvedValue(intervalHabit);
    repository.softRemove.mockResolvedValue(intervalHabit);

    await expect(service.remove(1)).resolves.toBeUndefined();

    expect(repository.softRemove).toHaveBeenCalledWith(intervalHabit);
  });
});
