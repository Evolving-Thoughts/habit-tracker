import { Test, TestingModule } from '@nestjs/testing';
import { CreateHabitDto } from './dto/create-habit.dto';
import { HabitEntity } from './entities/habit.entity';
import { HabitScheduleType } from './enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from './enums/missed-occurrence-policy.enum';
import { HabitsController } from './habits.controller';
import { HabitsService } from './habits.service';

type HabitsServiceMock = {
  findAll: jest.MockedFunction<() => Promise<HabitEntity[]>>;

  create: jest.MockedFunction<
    (createHabitDto: CreateHabitDto) => Promise<HabitEntity>
  >;
};

describe('HabitsController', () => {
  let controller: HabitsController;
  let serviceMock: HabitsServiceMock;

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
    serviceMock = {
      findAll: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HabitsController],
      providers: [
        {
          provide: HabitsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get(HabitsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('maps all habits to response DTOs', async () => {
      serviceMock.findAll.mockResolvedValue([intervalHabit]);

      await expect(controller.findAll()).resolves.toEqual([
        {
          id: 1,
          title: 'Joggen',
          scheduleType: HabitScheduleType.INTERVAL,
          startDate: '2026-09-20',
          intervalDays: 2,
          weekdays: null,
          weeklyTarget: null,
          missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
          isActive: true,
        },
      ]);

      expect(serviceMock.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('create', () => {
    it('creates and maps an interval habit', async () => {
      const createHabitDto: CreateHabitDto = {
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        startDate: '2026-09-20',
        intervalDays: 2,
      };

      serviceMock.create.mockResolvedValue(intervalHabit);

      await expect(controller.create(createHabitDto)).resolves.toEqual({
        id: 1,
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        startDate: '2026-09-20',
        intervalDays: 2,
        weekdays: null,
        weeklyTarget: null,
        missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
        isActive: true,
      });

      expect(serviceMock.create).toHaveBeenCalledWith(createHabitDto);
    });

    it('creates a habit without an explicit start date', async () => {
      const createHabitDto: CreateHabitDto = {
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        intervalDays: 2,
      };

      serviceMock.create.mockResolvedValue(intervalHabit);

      await expect(controller.create(createHabitDto)).resolves.toEqual({
        id: 1,
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        startDate: '2026-09-20',
        intervalDays: 2,
        weekdays: null,
        weeklyTarget: null,
        missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
        isActive: true,
      });

      expect(serviceMock.create).toHaveBeenCalledWith(createHabitDto);
    });
  });
});
