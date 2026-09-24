import { Repository, SelectQueryBuilder } from 'typeorm';
import { HabitEntity } from '../habits/entities/habit.entity';
import { HabitScheduleType } from '../habits/enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../habits/enums/missed-occurrence-policy.enum';
import { Weekday } from '../habits/enums/weekday.enum';
import { HabitOccurrenceEntity } from './entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from './enums/habit-occurrence-status.enum';
import { HabitOccurrenceGeneratorService } from './habit-occurrence-generator.service';
import { HabitOccurrencesService } from './habit-occurrences.service';

type HabitRepositoryMock = jest.Mocked<Pick<Repository<HabitEntity>, 'find'>>;

type OccurrenceRepositoryMock = jest.Mocked<
  Pick<
    Repository<HabitOccurrenceEntity>,
    'findOne' | 'findOneBy' | 'count' | 'createQueryBuilder'
  >
>;

type OccurrenceServiceMock = {
  createPendingOccurrence: jest.MockedFunction<
    (habitId: number, scheduledDate: string) => Promise<HabitOccurrenceEntity>
  >;

  updateStatus: jest.MockedFunction<
    (
      id: number,
      status: HabitOccurrenceStatus,
    ) => Promise<HabitOccurrenceEntity>
  >;
};

type QueryBuilderSetup = {
  queryBuilder: SelectQueryBuilder<HabitOccurrenceEntity>;
  getManyMock: jest.MockedFunction<() => Promise<HabitOccurrenceEntity[]>>;
};

function createQueryBuilderMock(): QueryBuilderSetup {
  const innerJoinAndSelectMock = jest.fn();
  const whereMock = jest.fn();
  const andWhereMock = jest.fn();
  const orderByMock = jest.fn();
  const addOrderByMock = jest.fn();

  const getManyMock: jest.MockedFunction<
    () => Promise<HabitOccurrenceEntity[]>
  > = jest.fn();

  const queryBuilderObject = {
    innerJoinAndSelect: innerJoinAndSelectMock,
    where: whereMock,
    andWhere: andWhereMock,
    orderBy: orderByMock,
    addOrderBy: addOrderByMock,
    getMany: getManyMock,
  };

  const queryBuilder =
    queryBuilderObject as unknown as SelectQueryBuilder<HabitOccurrenceEntity>;

  innerJoinAndSelectMock.mockReturnValue(queryBuilder);
  whereMock.mockReturnValue(queryBuilder);
  andWhereMock.mockReturnValue(queryBuilder);
  orderByMock.mockReturnValue(queryBuilder);
  addOrderByMock.mockReturnValue(queryBuilder);

  return {
    queryBuilder,
    getManyMock,
  };
}

describe('HabitOccurrenceGeneratorService', () => {
  let service: HabitOccurrenceGeneratorService;
  let habitRepository: HabitRepositoryMock;
  let occurrenceRepository: OccurrenceRepositoryMock;
  let occurrenceService: OccurrenceServiceMock;
  let getManyMock: jest.MockedFunction<() => Promise<HabitOccurrenceEntity[]>>;

  const intervalHabit: HabitEntity = {
    id: 1,
    title: 'Joggen',
    scheduleType: HabitScheduleType.INTERVAL,
    startDate: '2026-09-21',
    intervalDays: 2,
    weekdays: null,
    weeklyTarget: null,
    missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
    isActive: true,
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-09-01T10:00:00.000Z'),
    deletedAt: null,
  };

  const makeOccurrence = (
    properties: Partial<HabitOccurrenceEntity> = {},
  ): HabitOccurrenceEntity => ({
    id: 1,
    habitId: intervalHabit.id,
    habit: intervalHabit,
    scheduledDate: '2026-09-21',
    status: HabitOccurrenceStatus.PENDING,
    resolvedDate: null,
    createdAt: new Date('2026-09-21T08:00:00.000Z'),
    updatedAt: new Date('2026-09-21T08:00:00.000Z'),
    ...properties,
  });

  beforeEach(() => {
    jest.useFakeTimers();

    // Freitag, 25.09.2026
    jest.setSystemTime(new Date('2026-09-25T10:00:00.000Z'));

    habitRepository = {
      find: jest.fn(),
    };

    occurrenceRepository = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    occurrenceService = {
      createPendingOccurrence: jest.fn(),
      updateStatus: jest.fn(),
    };

    const queryBuilderSetup = createQueryBuilderMock();

    getManyMock = queryBuilderSetup.getManyMock;
    getManyMock.mockResolvedValue([]);

    occurrenceRepository.createQueryBuilder.mockReturnValue(
      queryBuilderSetup.queryBuilder,
    );

    service = new HabitOccurrenceGeneratorService(
      habitRepository as unknown as Repository<HabitEntity>,
      occurrenceRepository as unknown as Repository<HabitOccurrenceEntity>,
      occurrenceService as unknown as HabitOccurrencesService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('generateToday', () => {
    it('returns the occurrences selected for today', async () => {
      const todayOccurrence = makeOccurrence({
        scheduledDate: '2026-09-25',
      });

      habitRepository.find.mockResolvedValue([]);
      getManyMock.mockResolvedValue([todayOccurrence]);

      await expect(service.generateToday()).resolves.toEqual([todayOccurrence]);

      expect(occurrenceRepository.createQueryBuilder).toHaveBeenCalledWith(
        'occurrence',
      );
    });

    it('does not generate anything when no active habit is due', async () => {
      habitRepository.find.mockResolvedValue([]);

      await expect(service.generateToday()).resolves.toEqual([]);

      expect(occurrenceService.createPendingOccurrence).not.toHaveBeenCalled();

      expect(occurrenceService.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('interval habits', () => {
    it('creates the first occurrence when startDate is today', async () => {
      const habit: HabitEntity = {
        ...intervalHabit,
        startDate: '2026-09-25',
      };

      const todayOccurrence = makeOccurrence({
        scheduledDate: '2026-09-25',
      });

      habitRepository.find.mockResolvedValue([habit]);

      occurrenceRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      occurrenceService.createPendingOccurrence.mockResolvedValue(
        todayOccurrence,
      );

      await service.generateToday();

      expect(occurrenceService.createPendingOccurrence).toHaveBeenCalledTimes(
        1,
      );

      expect(occurrenceService.createPendingOccurrence).toHaveBeenCalledWith(
        habit.id,
        '2026-09-25',
      );

      expect(occurrenceService.updateStatus).not.toHaveBeenCalled();
    });

    it('backfills skipped dates and leaves today pending', async () => {
      habitRepository.find.mockResolvedValue([intervalHabit]);

      occurrenceRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const generatedOccurrences = new Map<number, HabitOccurrenceEntity>();

      let nextId = 1;

      occurrenceService.createPendingOccurrence.mockImplementation(
        (habitId, scheduledDate) => {
          const generatedOccurrence = makeOccurrence({
            id: nextId,
            habitId,
            scheduledDate,
          });

          generatedOccurrences.set(nextId, generatedOccurrence);

          nextId += 1;

          return Promise.resolve(generatedOccurrence);
        },
      );

      occurrenceService.updateStatus.mockImplementation((id, status) => {
        const generatedOccurrence = generatedOccurrences.get(id);

        if (!generatedOccurrence) {
          throw new Error(`Occurrence ${id} was not generated`);
        }

        const updatedOccurrence = {
          ...generatedOccurrence,
          status,
          resolvedDate: '2026-09-25',
        };

        generatedOccurrences.set(id, updatedOccurrence);

        return Promise.resolve(updatedOccurrence);
      });

      await service.generateToday();

      expect(occurrenceService.createPendingOccurrence).toHaveBeenNthCalledWith(
        1,
        intervalHabit.id,
        '2026-09-21',
      );

      expect(occurrenceService.createPendingOccurrence).toHaveBeenNthCalledWith(
        2,
        intervalHabit.id,
        '2026-09-23',
      );

      expect(occurrenceService.createPendingOccurrence).toHaveBeenNthCalledWith(
        3,
        intervalHabit.id,
        '2026-09-25',
      );

      expect(occurrenceService.updateStatus).toHaveBeenNthCalledWith(
        1,
        1,
        HabitOccurrenceStatus.SKIPPED,
      );

      expect(occurrenceService.updateStatus).toHaveBeenNthCalledWith(
        2,
        2,
        HabitOccurrenceStatus.SKIPPED,
      );

      expect(occurrenceService.updateStatus).toHaveBeenCalledTimes(2);
    });

    it('keeps a carry-over occurrence pending until the next interval date', async () => {
      jest.setSystemTime(new Date('2026-09-22T10:00:00.000Z'));

      const pendingOccurrence = makeOccurrence({
        scheduledDate: '2026-09-21',
      });

      habitRepository.find.mockResolvedValue([intervalHabit]);

      occurrenceRepository.findOne.mockResolvedValueOnce(pendingOccurrence);

      await service.generateToday();

      expect(occurrenceService.updateStatus).not.toHaveBeenCalled();

      expect(occurrenceService.createPendingOccurrence).not.toHaveBeenCalled();
    });

    it('skips carry-over when the next interval date is reached', async () => {
      jest.setSystemTime(new Date('2026-09-23T10:00:00.000Z'));

      const pendingOccurrence = makeOccurrence({
        id: 10,
        scheduledDate: '2026-09-21',
      });

      const skippedOccurrence = {
        ...pendingOccurrence,
        status: HabitOccurrenceStatus.SKIPPED,
        resolvedDate: '2026-09-23',
      };

      const newOccurrence = makeOccurrence({
        id: 11,
        scheduledDate: '2026-09-23',
      });

      habitRepository.find.mockResolvedValue([intervalHabit]);

      occurrenceRepository.findOne.mockResolvedValueOnce(pendingOccurrence);

      occurrenceService.updateStatus.mockResolvedValue(skippedOccurrence);

      occurrenceService.createPendingOccurrence.mockResolvedValue(
        newOccurrence,
      );

      await service.generateToday();

      expect(occurrenceService.updateStatus).toHaveBeenCalledWith(
        pendingOccurrence.id,
        HabitOccurrenceStatus.SKIPPED,
      );

      expect(occurrenceService.createPendingOccurrence).toHaveBeenCalledWith(
        intervalHabit.id,
        '2026-09-23',
      );
    });

    it('expires a skip-policy occurrence after its scheduled day', async () => {
      jest.setSystemTime(new Date('2026-09-22T10:00:00.000Z'));

      const skipHabit: HabitEntity = {
        ...intervalHabit,
        missedOccurrencePolicy: MissedOccurrencePolicy.SKIP,
      };

      const pendingOccurrence = makeOccurrence({
        id: 20,
        scheduledDate: '2026-09-21',
      });

      const skippedOccurrence = {
        ...pendingOccurrence,
        status: HabitOccurrenceStatus.SKIPPED,
        resolvedDate: '2026-09-22',
      };

      habitRepository.find.mockResolvedValue([skipHabit]);

      occurrenceRepository.findOne.mockResolvedValueOnce(pendingOccurrence);

      occurrenceService.updateStatus.mockResolvedValue(skippedOccurrence);

      await service.generateToday();

      expect(occurrenceService.updateStatus).toHaveBeenCalledWith(
        pendingOccurrence.id,
        HabitOccurrenceStatus.SKIPPED,
      );

      // Der nächste Termin wäre der 23.09. und
      // liegt damit noch in der Zukunft.
      expect(occurrenceService.createPendingOccurrence).not.toHaveBeenCalled();
    });

    it('does not create a duplicate when today is already pending', async () => {
      const todayOccurrence = makeOccurrence({
        id: 30,
        scheduledDate: '2026-09-25',
      });

      habitRepository.find.mockResolvedValue([intervalHabit]);

      occurrenceRepository.findOne.mockResolvedValueOnce(todayOccurrence);

      await service.generateToday();

      expect(occurrenceService.createPendingOccurrence).not.toHaveBeenCalled();

      expect(occurrenceService.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('fixed-weekday habits', () => {
    const fixedWeekdayHabit: HabitEntity = {
      ...intervalHabit,
      id: 2,
      title: 'Putzen',
      scheduleType: HabitScheduleType.FIXED_WEEKDAYS,
      startDate: '2026-09-21',
      intervalDays: null,
      weekdays: [Weekday.MONDAY, Weekday.THURSDAY],
    };

    it('skips the previous scheduled day when the next one has been reached', async () => {
      habitRepository.find.mockResolvedValue([fixedWeekdayHabit]);

      occurrenceRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const mondayOccurrence = makeOccurrence({
        id: 40,
        habitId: fixedWeekdayHabit.id,
        habit: fixedWeekdayHabit,
        scheduledDate: '2026-09-21',
      });

      const thursdayOccurrence = makeOccurrence({
        id: 41,
        habitId: fixedWeekdayHabit.id,
        habit: fixedWeekdayHabit,
        scheduledDate: '2026-09-24',
      });

      occurrenceService.createPendingOccurrence
        .mockResolvedValueOnce(mondayOccurrence)
        .mockResolvedValueOnce(thursdayOccurrence);

      occurrenceService.updateStatus.mockResolvedValue({
        ...mondayOccurrence,
        status: HabitOccurrenceStatus.SKIPPED,
        resolvedDate: '2026-09-25',
      });

      await service.generateToday();

      expect(occurrenceService.createPendingOccurrence).toHaveBeenNthCalledWith(
        1,
        fixedWeekdayHabit.id,
        '2026-09-21',
      );

      expect(occurrenceService.createPendingOccurrence).toHaveBeenNthCalledWith(
        2,
        fixedWeekdayHabit.id,
        '2026-09-24',
      );

      expect(occurrenceService.updateStatus).toHaveBeenCalledWith(
        mondayOccurrence.id,
        HabitOccurrenceStatus.SKIPPED,
      );
    });

    it('keeps a carry-over occurrence open before the next configured weekday', async () => {
      const wednesdaySaturdayHabit: HabitEntity = {
        ...fixedWeekdayHabit,
        weekdays: [Weekday.WEDNESDAY, Weekday.SATURDAY],
      };

      const wednesdayOccurrence = makeOccurrence({
        id: 50,
        habitId: wednesdaySaturdayHabit.id,
        habit: wednesdaySaturdayHabit,
        scheduledDate: '2026-09-23',
      });

      habitRepository.find.mockResolvedValue([wednesdaySaturdayHabit]);

      occurrenceRepository.findOne.mockResolvedValueOnce(wednesdayOccurrence);

      await service.generateToday();

      expect(occurrenceService.updateStatus).not.toHaveBeenCalled();

      expect(occurrenceService.createPendingOccurrence).not.toHaveBeenCalled();
    });
  });

  describe('weekly-target habits', () => {
    const weeklyTargetHabit: HabitEntity = {
      ...intervalHabit,
      id: 3,
      title: 'Gitarre spielen',
      scheduleType: HabitScheduleType.WEEKLY_TARGET,
      intervalDays: null,
      weekdays: null,
      weeklyTarget: 3,
    };

    it('creates a daily occurrence while the weekly target is not reached', async () => {
      const todayOccurrence = makeOccurrence({
        id: 60,
        habitId: weeklyTargetHabit.id,
        habit: weeklyTargetHabit,
        scheduledDate: '2026-09-25',
      });

      habitRepository.find.mockResolvedValue([weeklyTargetHabit]);

      occurrenceRepository.findOne.mockResolvedValueOnce(null);

      occurrenceRepository.count.mockResolvedValue(1);

      occurrenceRepository.findOneBy.mockResolvedValue(null);

      occurrenceService.createPendingOccurrence.mockResolvedValue(
        todayOccurrence,
      );

      await service.generateToday();

      expect(occurrenceRepository.count).toHaveBeenCalledTimes(1);

      expect(occurrenceService.createPendingOccurrence).toHaveBeenCalledWith(
        weeklyTargetHabit.id,
        '2026-09-25',
      );
    });

    it('does not create another occurrence after reaching the weekly target', async () => {
      habitRepository.find.mockResolvedValue([weeklyTargetHabit]);

      occurrenceRepository.findOne.mockResolvedValueOnce(null);

      occurrenceRepository.count.mockResolvedValue(3);

      await service.generateToday();

      expect(occurrenceService.createPendingOccurrence).not.toHaveBeenCalled();

      expect(occurrenceRepository.findOneBy).not.toHaveBeenCalled();
    });

    it('returns without creating when today is already pending', async () => {
      const todayOccurrence = makeOccurrence({
        id: 70,
        habitId: weeklyTargetHabit.id,
        habit: weeklyTargetHabit,
        scheduledDate: '2026-09-25',
      });

      habitRepository.find.mockResolvedValue([weeklyTargetHabit]);

      occurrenceRepository.findOne.mockResolvedValueOnce(todayOccurrence);

      await service.generateToday();

      expect(occurrenceRepository.count).not.toHaveBeenCalled();

      expect(occurrenceService.createPendingOccurrence).not.toHaveBeenCalled();
    });

    it('skips yesterday and creates a new occurrence today', async () => {
      const yesterdayOccurrence = makeOccurrence({
        id: 80,
        habitId: weeklyTargetHabit.id,
        habit: weeklyTargetHabit,
        scheduledDate: '2026-09-24',
      });

      const skippedOccurrence = {
        ...yesterdayOccurrence,
        status: HabitOccurrenceStatus.SKIPPED,
        resolvedDate: '2026-09-25',
      };

      const todayOccurrence = makeOccurrence({
        id: 81,
        habitId: weeklyTargetHabit.id,
        habit: weeklyTargetHabit,
        scheduledDate: '2026-09-25',
      });

      habitRepository.find.mockResolvedValue([weeklyTargetHabit]);

      occurrenceRepository.findOne.mockResolvedValueOnce(yesterdayOccurrence);

      occurrenceService.updateStatus.mockResolvedValue(skippedOccurrence);

      occurrenceRepository.count.mockResolvedValue(1);

      occurrenceRepository.findOneBy.mockResolvedValue(null);

      occurrenceService.createPendingOccurrence.mockResolvedValue(
        todayOccurrence,
      );

      await service.generateToday();

      expect(occurrenceService.updateStatus).toHaveBeenCalledWith(
        yesterdayOccurrence.id,
        HabitOccurrenceStatus.SKIPPED,
      );

      expect(occurrenceService.createPendingOccurrence).toHaveBeenCalledWith(
        weeklyTargetHabit.id,
        '2026-09-25',
      );
    });

    it('does not duplicate an existing resolved occurrence for today', async () => {
      const completedToday = makeOccurrence({
        id: 90,
        habitId: weeklyTargetHabit.id,
        habit: weeklyTargetHabit,
        scheduledDate: '2026-09-25',
        status: HabitOccurrenceStatus.COMPLETED,
        resolvedDate: '2026-09-25',
      });

      habitRepository.find.mockResolvedValue([weeklyTargetHabit]);

      occurrenceRepository.findOne.mockResolvedValueOnce(null);

      occurrenceRepository.count.mockResolvedValue(1);

      occurrenceRepository.findOneBy.mockResolvedValue(completedToday);

      await service.generateToday();

      expect(occurrenceService.createPendingOccurrence).not.toHaveBeenCalled();
    });
  });
});
