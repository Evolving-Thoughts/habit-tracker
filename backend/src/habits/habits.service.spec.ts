import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { HabitEntity } from './entities/habit.entity';
import { HabitScheduleVersionEntity } from './entities/habit-schedule-version.entity';
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

type VersionRepositoryMock = jest.Mocked<
  Pick<Repository<HabitScheduleVersionEntity>, 'save'>
>;

function makeRepositoryMock(): HabitRepositoryMock {
  return {
    find: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    preload: jest.fn(),
    softRemove: jest.fn(),
  };
}

function makeHabit(overrides: Partial<HabitEntity> = {}): HabitEntity {
  return {
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
    ...overrides,
  };
}

describe('HabitsService', () => {
  let service: HabitsService;
  let repository: HabitRepositoryMock;
  let transactionRepository: HabitRepositoryMock;
  let versionRepository: VersionRepositoryMock;

  let transactionMock: jest.Mock<
    Promise<HabitEntity>,
    [(manager: EntityManager) => Promise<HabitEntity>]
  >;

  beforeEach(async () => {
    repository = makeRepositoryMock();
    transactionRepository = makeRepositoryMock();

    versionRepository = {
      save: jest.fn(),
    };

    const getRepository = jest.fn(
      (entity: typeof HabitEntity | typeof HabitScheduleVersionEntity) => {
        if (entity === HabitEntity) {
          return transactionRepository;
        }

        if (entity === HabitScheduleVersionEntity) {
          return versionRepository;
        }

        throw new Error('Unexpected entity in transaction');
      },
    );

    // Begrenzter Test-Stub: Der Service verwendet nur getRepository().
    const manager = {
      getRepository,
    } as unknown as EntityManager;

    transactionMock = jest.fn<
      Promise<HabitEntity>,
      [(manager: EntityManager) => Promise<HabitEntity>]
    >();

    transactionMock.mockImplementation((work) => work(manager));

    const moduleFixture = await Test.createTestingModule({
      providers: [
        HabitsService,
        {
          provide: getRepositoryToken(HabitEntity),
          useValue: repository,
        },
        {
          provide: DataSource,
          useValue: {
            transaction: transactionMock,
          },
        },
      ],
    }).compile();

    service = moduleFixture.get(HabitsService);

    const habit = makeHabit();

    transactionRepository.create.mockReturnValue(habit);
    transactionRepository.save.mockResolvedValue(habit);

    versionRepository.save.mockImplementation((version) =>
      Promise.resolve(version as HabitScheduleVersionEntity),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('returns all habits', async () => {
    const habit = makeHabit();

    repository.find.mockResolvedValue([habit]);

    await expect(service.findAll()).resolves.toEqual([habit]);

    expect(repository.find).toHaveBeenCalledWith({
      order: { id: 'ASC' },
    });
  });

  it('creates a habit and its first version inside a transaction', async () => {
    const habit = makeHabit();

    await expect(
      service.create({
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        startDate: '2026-09-20',
        intervalDays: 2,
      }),
    ).resolves.toEqual(habit);

    expect(transactionMock).toHaveBeenCalledTimes(1);

    expect(transactionRepository.create).toHaveBeenCalledWith({
      title: 'Joggen',
      scheduleType: HabitScheduleType.INTERVAL,
      startDate: '2026-09-20',
      intervalDays: 2,
      weekdays: null,
      weeklyTarget: null,
      missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
      isActive: true,
    });

    expect(versionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        habitId: habit.id,
        scheduleType: HabitScheduleType.INTERVAL,
        validFrom: '2026-09-20',
        validUntil: null,
        firstDueDate: '2026-09-20',
        intervalDays: 2,
        weekdays: null,
        weeklyTarget: null,
      }),
    );

    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('propagates a failure while saving the first version', async () => {
    const error = new Error('Version could not be saved');

    versionRepository.save.mockRejectedValue(error);

    await expect(
      service.create({
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        startDate: '2026-09-20',
        intervalDays: 2,
      }),
    ).rejects.toThrow(error);
  });

  it('does not save a version when saving the habit fails', async () => {
    transactionRepository.save.mockRejectedValue(
      new Error('Habit could not be saved'),
    );

    await expect(
      service.create({
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        intervalDays: 2,
      }),
    ).rejects.toThrow('Habit could not be saved');

    expect(versionRepository.save).not.toHaveBeenCalled();
  });

  it('rejects an interval habit without intervalDays before opening a transaction', async () => {
    await expect(
      service.create({
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('rejects incompatible fields before opening a transaction', async () => {
    await expect(
      service.create({
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        intervalDays: 2,
        weekdays: [Weekday.MONDAY],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('defaults startDate and the interval anchor to the current Berlin date', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-18T22:30:00.000Z'));

    const habit = makeHabit({
      startDate: '2026-09-19',
    });

    transactionRepository.create.mockReturnValue(habit);
    transactionRepository.save.mockResolvedValue(habit);

    await expect(
      service.create({
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        intervalDays: 2,
      }),
    ).resolves.toEqual(habit);

    expect(transactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: '2026-09-19',
      }),
    );

    expect(versionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        validFrom: '2026-09-19',
        firstDueDate: '2026-09-19',
      }),
    );
  });

  it('returns one habit', async () => {
    const habit = makeHabit();

    repository.findOneBy.mockResolvedValue(habit);

    await expect(service.findOne(1)).resolves.toEqual(habit);

    expect(repository.findOneBy).toHaveBeenCalledWith({ id: 1 });
  });

  it('throws when a habit does not exist', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('pauses a habit', async () => {
    const habit = makeHabit({ isActive: false });

    repository.preload.mockResolvedValue(habit);
    repository.save.mockResolvedValue(habit);

    await expect(service.update(1, { isActive: false })).resolves.toEqual(
      habit,
    );

    expect(repository.preload).toHaveBeenCalledWith({
      id: 1,
      isActive: false,
    });
  });

  it('preserves the existing schedule-update behavior during the transition', async () => {
    const habit = makeHabit({
      scheduleType: HabitScheduleType.FIXED_WEEKDAYS,
      intervalDays: null,
      weekdays: [Weekday.MONDAY, Weekday.THURSDAY],
    });

    repository.preload.mockResolvedValue(habit);
    repository.save.mockResolvedValue(habit);

    await expect(
      service.update(1, {
        scheduleType: HabitScheduleType.FIXED_WEEKDAYS,
        intervalDays: null,
        weekdays: [Weekday.MONDAY, Weekday.THURSDAY],
      }),
    ).resolves.toEqual(habit);

    expect(repository.save).toHaveBeenCalledWith(habit);
  });

  it('rejects a schedule change with incompatible fields', async () => {
    repository.preload.mockResolvedValue(
      makeHabit({
        scheduleType: HabitScheduleType.FIXED_WEEKDAYS,
        weekdays: [Weekday.MONDAY],
        intervalDays: 2,
      }),
    );

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

  it('throws when updating a missing habit', async () => {
    repository.preload.mockResolvedValue(undefined);

    await expect(service.update(999, { title: 'Missing' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('soft-deletes an existing habit', async () => {
    const habit = makeHabit();

    repository.findOneBy.mockResolvedValue(habit);
    repository.softRemove.mockResolvedValue(habit);

    await expect(service.remove(1)).resolves.toBeUndefined();

    expect(repository.softRemove).toHaveBeenCalledWith(habit);
  });
});
