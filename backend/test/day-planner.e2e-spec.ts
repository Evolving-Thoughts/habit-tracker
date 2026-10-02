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
import { TodoEntity } from '../src/todos/entities/todo.entity';

type TodoResponseBody = {
  id: number;
  title: string;
  completed: boolean;
  completedAt: string | null;
  scheduledAt: string | null;
  plannedDurationMinutes: number | null;
  isFixed: boolean;
};

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

type DayPlannerTodoItemBody = {
  type: 'todo';
  todoId: number;
  title: string;
  status: 'pending' | 'completed';
  scheduledDate: string;
  scheduledAt: string;
  completedAt: string | null;
  plannedDurationMinutes: number | null;
  isFixed: boolean;
  isOverdue: boolean;
};

type DayPlannerHabitItemBody = {
  type: 'habit';
  occurrenceId: number;
  habitId: number;
  title: string;
  status: HabitOccurrenceStatus;
  scheduledDate: string;
  scheduleType: HabitScheduleType;
  isOverdue: boolean;
};

type DayPlannerItemBody = DayPlannerTodoItemBody | DayPlannerHabitItemBody;

type DayPlannerResponseBody = {
  date: string;
  items: DayPlannerItemBody[];
};

type HabitOccurrenceResponseBody = {
  id: number;
  habitId: number;
  scheduledDate: string;
  status: HabitOccurrenceStatus;
  resolvedDate: string | null;
};

function isTodoItem(item: DayPlannerItemBody): item is DayPlannerTodoItemBody {
  return item.type === 'todo';
}

function isHabitItem(
  item: DayPlannerItemBody,
): item is DayPlannerHabitItemBody {
  return item.type === 'habit';
}

describe('Day planner API (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let todoRepository: Repository<TodoEntity>;
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

    todoRepository = moduleFixture.get<Repository<TodoEntity>>(
      getRepositoryToken(TodoEntity),
    );

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

    await todoRepository.createQueryBuilder().delete().execute();
  });

  afterAll(async () => {
    await app.close();
  });

  async function createTodo(
    title: string,
    options: {
      scheduledAt?: string;
      plannedDurationMinutes?: number;
      isFixed?: boolean;
    } = {},
  ): Promise<TodoResponseBody> {
    const response = await request(httpServer)
      .post('/todos')
      .send({
        title,
        ...options,
      })
      .expect(201);

    return response.body as TodoResponseBody;
  }

  async function createIntervalHabit(
    startDate: string,
  ): Promise<HabitResponseBody> {
    const response = await request(httpServer)
      .post('/habits')
      .send({
        title: 'Joggen',
        scheduleType: HabitScheduleType.INTERVAL,
        startDate,
        intervalDays: 2,
        missedOccurrencePolicy: MissedOccurrencePolicy.CARRY_OVER,
      })
      .expect(201);

    return response.body as HabitResponseBody;
  }

  async function getPlanner(): Promise<DayPlannerResponseBody> {
    const response = await request(httpServer)
      .get('/day-planner/today')
      .expect(200);

    return response.body as DayPlannerResponseBody;
  }

  describe('GET /day-planner/today', () => {
    it('combines due todos and habit occurrences', async () => {
      const today = getCurrentDateInTimeZone();

      const yesterday = HabitScheduleCalculator.addDays(today, -1);

      const tomorrow = HabitScheduleCalculator.addDays(today, 1);

      const unscheduledTodo = await createTodo('Todo dump item');

      const overdueTodo = await createTodo('Überfälliges Todo', {
        scheduledAt: `${yesterday}T08:00:00.000Z`,
        plannedDurationMinutes: 30,
        isFixed: false,
      });

      const todayTodo = await createTodo('Heutiger Termin', {
        scheduledAt: `${today}T10:00:00.000Z`,
        plannedDurationMinutes: 60,
        isFixed: true,
      });

      const futureTodo = await createTodo('Zukünftiges Todo', {
        scheduledAt: `${tomorrow}T08:00:00.000Z`,
      });

      const completedTodo = await createTodo('Heute erledigtes Todo', {
        scheduledAt: `${yesterday}T12:00:00.000Z`,
      });

      await request(httpServer)
        .patch(`/todos/${completedTodo.id}`)
        .send({
          completed: true,
        })
        .expect(200);

      const habit = await createIntervalHabit(today);

      const body = await getPlanner();

      expect(body.date).toBe(today);

      const todoItems = body.items.filter(isTodoItem);
      const habitItems = body.items.filter(isHabitItem);

      expect(todoItems).toHaveLength(3);
      expect(habitItems).toHaveLength(1);

      const returnedTodoIds = todoItems.map((item) => item.todoId);

      expect(returnedTodoIds).toContain(overdueTodo.id);
      expect(returnedTodoIds).toContain(todayTodo.id);
      expect(returnedTodoIds).toContain(completedTodo.id);

      expect(returnedTodoIds).not.toContain(unscheduledTodo.id);

      expect(returnedTodoIds).not.toContain(futureTodo.id);

      const overdueItem = todoItems.find(
        (item) => item.todoId === overdueTodo.id,
      );

      expect(overdueItem).toEqual({
        type: 'todo',
        todoId: overdueTodo.id,
        title: 'Überfälliges Todo',
        status: 'pending',
        scheduledDate: yesterday,
        scheduledAt: `${yesterday}T08:00:00.000Z`,
        completedAt: null,
        plannedDurationMinutes: 30,
        isFixed: false,
        isOverdue: true,
      });

      const todayItem = todoItems.find((item) => item.todoId === todayTodo.id);

      expect(todayItem).toEqual({
        type: 'todo',
        todoId: todayTodo.id,
        title: 'Heutiger Termin',
        status: 'pending',
        scheduledDate: today,
        scheduledAt: `${today}T10:00:00.000Z`,
        completedAt: null,
        plannedDurationMinutes: 60,
        isFixed: true,
        isOverdue: false,
      });

      const completedItem = todoItems.find(
        (item) => item.todoId === completedTodo.id,
      );

      expect(completedItem).toBeDefined();
      expect(completedItem?.status).toBe('completed');
      expect(completedItem?.completedAt).toEqual(expect.any(String));
      expect(completedItem?.isOverdue).toBe(false);

      expect(habitItems[0]).toEqual({
        type: 'habit',
        occurrenceId: expect.any(Number) as number,
        habitId: habit.id,
        title: 'Joggen',
        status: HabitOccurrenceStatus.PENDING,
        scheduledDate: today,
        scheduleType: HabitScheduleType.INTERVAL,
        isOverdue: false,
      });
    });

    it('keeps a completed habit occurrence visible for the rest of the day', async () => {
      const today = getCurrentDateInTimeZone();
      const habit = await createIntervalHabit(today);

      const initialPlanner = await getPlanner();

      const pendingOccurrence = initialPlanner.items
        .filter(isHabitItem)
        .find((item) => item.habitId === habit.id);

      if (!pendingOccurrence) {
        throw new Error('Expected a pending habit occurrence');
      }

      await request(httpServer)
        .patch(`/habit-occurrences/${pendingOccurrence.occurrenceId}/status`)
        .send({
          status: HabitOccurrenceStatus.COMPLETED,
        })
        .expect(200);

      const completedPlanner = await getPlanner();

      const completedOccurrence = completedPlanner.items
        .filter(isHabitItem)
        .find((item) => item.habitId === habit.id);

      expect(completedOccurrence).toEqual({
        type: 'habit',
        occurrenceId: pendingOccurrence.occurrenceId,
        habitId: habit.id,
        title: 'Joggen',
        status: HabitOccurrenceStatus.COMPLETED,
        scheduledDate: today,
        scheduleType: HabitScheduleType.INTERVAL,
        isOverdue: false,
      });
    });

    it('keeps backfilled skips in history but excludes them from today', async () => {
      const today = getCurrentDateInTimeZone();

      const fourDaysAgo = HabitScheduleCalculator.addDays(today, -4);

      const twoDaysAgo = HabitScheduleCalculator.addDays(today, -2);

      const habit = await createIntervalHabit(fourDaysAgo);

      const body = await getPlanner();

      const habitItems = body.items
        .filter(isHabitItem)
        .filter((item) => item.habitId === habit.id);

      expect(habitItems).toEqual([
        {
          type: 'habit',
          occurrenceId: expect.any(Number) as number,
          habitId: habit.id,
          title: 'Joggen',
          status: HabitOccurrenceStatus.PENDING,
          scheduledDate: today,
          scheduleType: HabitScheduleType.INTERVAL,
          isOverdue: false,
        },
      ]);

      const historyResponse = await request(httpServer)
        .get(`/habits/${habit.id}/occurrences`)
        .expect(200);

      const history = historyResponse.body as HabitOccurrenceResponseBody[];

      expect(history).toEqual([
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
          id: habitItems[0]?.occurrenceId,
          habitId: habit.id,
          scheduledDate: today,
          status: HabitOccurrenceStatus.PENDING,
          resolvedDate: null,
        },
      ]);

      expect(
        await occurrenceRepository.count({
          where: {
            habitId: habit.id,
          },
        }),
      ).toBe(3);
    });

    it('includes a late habit occurrence completed today', async () => {
      const today = getCurrentDateInTimeZone();

      const yesterday = HabitScheduleCalculator.addDays(today, -1);

      const habit = await createIntervalHabit(yesterday);

      const occurrence = occurrenceRepository.create({
        habitId: habit.id,
        scheduledDate: yesterday,
        status: HabitOccurrenceStatus.COMPLETED,
        resolvedDate: today,
      });

      const savedOccurrence = await occurrenceRepository.save(occurrence);

      const body = await getPlanner();

      expect(body.items).toEqual([
        {
          type: 'habit',
          occurrenceId: savedOccurrence.id,
          habitId: habit.id,
          title: 'Joggen',
          status: HabitOccurrenceStatus.COMPLETED,
          scheduledDate: yesterday,
          scheduleType: HabitScheduleType.INTERVAL,
          isOverdue: false,
        },
      ]);
    });

    it('keeps a habit skipped today visible when it was scheduled for today', async () => {
      const today = getCurrentDateInTimeZone();
      const habit = await createIntervalHabit(today);

      const initialPlanner = await getPlanner();

      const pendingOccurrence = initialPlanner.items
        .filter(isHabitItem)
        .find((item) => item.habitId === habit.id);

      if (!pendingOccurrence) {
        throw new Error('Expected a pending habit occurrence');
      }

      await request(httpServer)
        .patch(`/habit-occurrences/${pendingOccurrence.occurrenceId}/status`)
        .send({
          status: HabitOccurrenceStatus.SKIPPED,
        })
        .expect(200);

      const planner = await getPlanner();

      expect(planner.items).toEqual([
        {
          type: 'habit',
          occurrenceId: pendingOccurrence.occurrenceId,
          habitId: habit.id,
          title: 'Joggen',
          status: HabitOccurrenceStatus.SKIPPED,
          scheduledDate: today,
          scheduleType: HabitScheduleType.INTERVAL,
          isOverdue: false,
        },
      ]);
    });

    it('excludes habit occurrences resolved on previous days', async () => {
      const today = getCurrentDateInTimeZone();

      const yesterday = HabitScheduleCalculator.addDays(today, -1);

      const completedHabit = await createIntervalHabit(yesterday);

      const skippedHabit = await createIntervalHabit(yesterday);

      await occurrenceRepository.save(
        occurrenceRepository.create({
          habitId: completedHabit.id,
          scheduledDate: yesterday,
          status: HabitOccurrenceStatus.COMPLETED,
          resolvedDate: yesterday,
        }),
      );

      await occurrenceRepository.save(
        occurrenceRepository.create({
          habitId: skippedHabit.id,
          scheduledDate: yesterday,
          status: HabitOccurrenceStatus.SKIPPED,
          resolvedDate: yesterday,
        }),
      );

      // Beide nächsten Intervalltermine liegen
      // erst morgen.
      const body = await getPlanner();

      expect(body.items).toEqual([]);
      expect(await occurrenceRepository.count()).toBe(2);
    });

    it('excludes completed todos from previous days', async () => {
      const today = getCurrentDateInTimeZone();

      const yesterday = HabitScheduleCalculator.addDays(today, -1);

      const todo = todoRepository.create({
        title: 'Gestern erledigt',
        completed: true,
        completedAt: new Date(`${yesterday}T12:00:00.000Z`),
        scheduledAt: new Date(`${yesterday}T08:00:00.000Z`),
        plannedDurationMinutes: null,
        isFixed: false,
      });

      await todoRepository.save(todo);

      const body = await getPlanner();

      expect(body.items).toEqual([]);
    });

    it('excludes completed unscheduled todos', async () => {
      const todo = todoRepository.create({
        title: 'Todo dump item',
        completed: true,
        completedAt: new Date(),
        scheduledAt: null,
        plannedDurationMinutes: null,
        isFixed: false,
      });

      await todoRepository.save(todo);

      const body = await getPlanner();

      expect(body.items).toEqual([]);
    });

    it('returns an empty planner when nothing is due', async () => {
      const today = getCurrentDateInTimeZone();

      expect(await getPlanner()).toEqual({
        date: today,
        items: [],
      });
    });
  });
});
