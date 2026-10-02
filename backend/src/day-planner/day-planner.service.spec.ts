import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitOccurrenceGeneratorService } from '../habit-occurrences/habit-occurrence-generator.service';
import { HabitEntity } from '../habits/entities/habit.entity';
import { HabitScheduleType } from '../habits/enums/habit-schedule-type.enum';
import { MissedOccurrencePolicy } from '../habits/enums/missed-occurrence-policy.enum';
import { TodoEntity } from '../todos/entities/todo.entity';
import { DayPlannerService } from './day-planner.service';

type TodoRepositoryMock = jest.Mocked<
  Pick<Repository<TodoEntity>, 'createQueryBuilder'>
>;

type OccurrenceGeneratorMock = {
  generateToday: jest.MockedFunction<() => Promise<HabitOccurrenceEntity[]>>;
};

type QueryBuilderSetup = {
  queryBuilder: SelectQueryBuilder<TodoEntity>;
  getManyMock: jest.MockedFunction<() => Promise<TodoEntity[]>>;
};

function createQueryBuilderMock(): QueryBuilderSetup {
  const whereMock = jest.fn();
  const andWhereMock = jest.fn();
  const orderByMock = jest.fn();
  const addOrderByMock = jest.fn();

  const getManyMock: jest.MockedFunction<() => Promise<TodoEntity[]>> =
    jest.fn();

  const queryBuilderObject = {
    where: whereMock,
    andWhere: andWhereMock,
    orderBy: orderByMock,
    addOrderBy: addOrderByMock,
    getMany: getManyMock,
  };

  const queryBuilder =
    queryBuilderObject as unknown as SelectQueryBuilder<TodoEntity>;

  whereMock.mockReturnValue(queryBuilder);
  andWhereMock.mockReturnValue(queryBuilder);
  orderByMock.mockReturnValue(queryBuilder);
  addOrderByMock.mockReturnValue(queryBuilder);

  return {
    queryBuilder,
    getManyMock,
  };
}

describe('DayPlannerService', () => {
  let service: DayPlannerService;
  let todoRepository: TodoRepositoryMock;
  let occurrenceGenerator: OccurrenceGeneratorMock;
  let getManyMock: jest.MockedFunction<() => Promise<TodoEntity[]>>;

  const habit: HabitEntity = {
    id: 10,
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

  const overdueTodo: TodoEntity = {
    id: 1,
    title: 'Überfälliges Todo',
    completed: false,
    completedAt: null,
    scheduledAt: new Date('2026-09-24T08:00:00.000Z'),
    plannedDurationMinutes: 30,
    isFixed: false,
    createdAt: new Date('2026-09-20T10:00:00.000Z'),
    updatedAt: new Date('2026-09-20T10:00:00.000Z'),
    deletedAt: null,
  };

  const completedTodo: TodoEntity = {
    id: 2,
    title: 'Erledigter Termin',
    completed: true,
    completedAt: new Date('2026-09-25T11:00:00.000Z'),
    scheduledAt: new Date('2026-09-25T10:00:00.000Z'),
    plannedDurationMinutes: 60,
    isFixed: true,
    createdAt: new Date('2026-09-20T10:00:00.000Z'),
    updatedAt: new Date('2026-09-25T11:00:00.000Z'),
    deletedAt: null,
  };

  const habitOccurrence: HabitOccurrenceEntity = {
    id: 20,
    habitId: habit.id,
    habit,
    scheduledDate: '2026-09-25',
    status: HabitOccurrenceStatus.PENDING,
    resolvedDate: null,
    createdAt: new Date('2026-09-25T08:00:00.000Z'),
    updatedAt: new Date('2026-09-25T08:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.useFakeTimers();

    jest.setSystemTime(new Date('2026-09-25T12:00:00.000Z'));

    const queryBuilderSetup = createQueryBuilderMock();

    getManyMock = queryBuilderSetup.getManyMock;

    todoRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(queryBuilderSetup.queryBuilder),
    };

    occurrenceGenerator = {
      generateToday: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DayPlannerService,
        {
          provide: getRepositoryToken(TodoEntity),
          useValue: todoRepository,
        },
        {
          provide: HabitOccurrenceGeneratorService,
          useValue: occurrenceGenerator,
        },
      ],
    }).compile();

    service = module.get(DayPlannerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getToday', () => {
    it('combines todos and habit occurrences', async () => {
      getManyMock.mockResolvedValue([overdueTodo, completedTodo]);

      occurrenceGenerator.generateToday.mockResolvedValue([habitOccurrence]);

      await expect(service.getToday()).resolves.toEqual({
        date: '2026-09-25',
        items: [
          {
            type: 'todo',
            todoId: 1,
            title: 'Überfälliges Todo',
            status: 'pending',
            scheduledDate: '2026-09-24',
            scheduledAt: '2026-09-24T08:00:00.000Z',
            completedAt: null,
            plannedDurationMinutes: 30,
            isFixed: false,
            isOverdue: true,
          },
          {
            type: 'habit',
            occurrenceId: 20,
            habitId: 10,
            title: 'Joggen',
            status: HabitOccurrenceStatus.PENDING,
            scheduledDate: '2026-09-25',
            scheduleType: HabitScheduleType.INTERVAL,
            isOverdue: false,
          },
          {
            type: 'todo',
            todoId: 2,
            title: 'Erledigter Termin',
            status: 'completed',
            scheduledDate: '2026-09-25',
            scheduledAt: '2026-09-25T10:00:00.000Z',
            completedAt: '2026-09-25T11:00:00.000Z',
            plannedDurationMinutes: 60,
            isFixed: true,
            isOverdue: false,
          },
        ],
      });

      expect(todoRepository.createQueryBuilder).toHaveBeenCalledWith('todo');

      expect(occurrenceGenerator.generateToday).toHaveBeenCalledTimes(1);
    });

    it('returns an empty planner when nothing is scheduled', async () => {
      getManyMock.mockResolvedValue([]);

      occurrenceGenerator.generateToday.mockResolvedValue([]);

      await expect(service.getToday()).resolves.toEqual({
        date: '2026-09-25',
        items: [],
      });
    });

    it('marks an overdue habit occurrence as overdue', async () => {
      const overdueOccurrence: HabitOccurrenceEntity = {
        ...habitOccurrence,
        scheduledDate: '2026-09-23',
      };

      getManyMock.mockResolvedValue([]);

      occurrenceGenerator.generateToday.mockResolvedValue([overdueOccurrence]);

      const result = await service.getToday();

      expect(result.items).toEqual([
        {
          type: 'habit',
          occurrenceId: 20,
          habitId: 10,
          title: 'Joggen',
          status: HabitOccurrenceStatus.PENDING,
          scheduledDate: '2026-09-23',
          scheduleType: HabitScheduleType.INTERVAL,
          isOverdue: true,
        },
      ]);
    });

    it('does not mark completed habit occurrences as overdue', async () => {
      const completedOccurrence: HabitOccurrenceEntity = {
        ...habitOccurrence,
        scheduledDate: '2026-09-23',
        status: HabitOccurrenceStatus.COMPLETED,
        resolvedDate: '2026-09-25',
      };

      getManyMock.mockResolvedValue([]);

      occurrenceGenerator.generateToday.mockResolvedValue([
        completedOccurrence,
      ]);

      const result = await service.getToday();

      expect(result.items).toEqual([
        {
          type: 'habit',
          occurrenceId: 20,
          habitId: 10,
          title: 'Joggen',
          status: HabitOccurrenceStatus.COMPLETED,
          scheduledDate: '2026-09-23',
          scheduleType: HabitScheduleType.INTERVAL,
          isOverdue: false,
        },
      ]);
    });

    it('does not mark completed todos as overdue', async () => {
      const completedOverdueTodo: TodoEntity = {
        ...completedTodo,
        scheduledAt: new Date('2026-09-23T10:00:00.000Z'),
      };

      getManyMock.mockResolvedValue([completedOverdueTodo]);

      occurrenceGenerator.generateToday.mockResolvedValue([]);

      const result = await service.getToday();

      expect(result.items).toEqual([
        {
          type: 'todo',
          todoId: 2,
          title: 'Erledigter Termin',
          status: 'completed',
          scheduledDate: '2026-09-23',
          scheduledAt: '2026-09-23T10:00:00.000Z',
          completedAt: '2026-09-25T11:00:00.000Z',
          plannedDurationMinutes: 60,
          isFixed: true,
          isOverdue: false,
        },
      ]);
    });

    it('sorts all-day habits before timed todos on the same date', async () => {
      const scheduledTodo: TodoEntity = {
        ...overdueTodo,
        id: 3,
        title: 'Todo am selben Tag',
        scheduledAt: new Date('2026-09-25T08:00:00.000Z'),
      };

      getManyMock.mockResolvedValue([scheduledTodo]);

      occurrenceGenerator.generateToday.mockResolvedValue([habitOccurrence]);

      const result = await service.getToday();

      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.type).toBe('habit');
      expect(result.items[1]?.type).toBe('todo');
    });

    it('throws when a returned todo has no scheduledAt', async () => {
      const unscheduledTodo: TodoEntity = {
        ...overdueTodo,
        scheduledAt: null,
      };

      getManyMock.mockResolvedValue([unscheduledTodo]);

      occurrenceGenerator.generateToday.mockResolvedValue([]);

      await expect(service.getToday()).rejects.toThrow(
        'Scheduled todo 1 has no scheduledAt',
      );
    });

    it('throws when an occurrence has no loaded habit relation', async () => {
      const occurrenceWithoutHabit = {
        ...habitOccurrence,
        habit: undefined,
      } as unknown as HabitOccurrenceEntity;

      getManyMock.mockResolvedValue([]);

      occurrenceGenerator.generateToday.mockResolvedValue([
        occurrenceWithoutHabit,
      ]);

      await expect(service.getToday()).rejects.toThrow(
        'Habit occurrence 20 has no habit relation',
      );
    });
  });
});
