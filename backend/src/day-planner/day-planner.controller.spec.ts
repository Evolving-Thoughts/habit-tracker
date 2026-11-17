import { Test, TestingModule } from '@nestjs/testing';
import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitScheduleType } from '../habits/enums/habit-schedule-type.enum';
import { DayPlannerController } from './day-planner.controller';
import { DayPlannerService } from './day-planner.service';
import { DayPlannerResponseDto } from './dto/day-planner-response.dto';
import { WeekPlanResponseDto } from './dto/week-plan.dto';

type DayPlannerServiceMock = {
  getToday: jest.MockedFunction<() => Promise<DayPlannerResponseDto>>;
  getWeek: jest.MockedFunction<
    (userId: string, start: string) => Promise<WeekPlanResponseDto>
  >;
};

describe('DayPlannerController', () => {
  let controller: DayPlannerController;
  let serviceMock: DayPlannerServiceMock;

  beforeEach(async () => {
    serviceMock = {
      getToday: jest.fn(),
      getWeek: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DayPlannerController],
      providers: [
        {
          provide: DayPlannerService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get(DayPlannerController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getToday', () => {
    it('returns the current day planner', async () => {
      const response = new DayPlannerResponseDto({
        date: '2026-09-25',
        items: [
          {
            type: 'todo',
            todoId: 1,
            title: 'Learn NestJS',
            status: 'pending',
            scheduledDate: '2026-09-25',
            scheduledAt: '2026-09-25T10:00:00.000Z',
            completedAt: null,
            plannedDurationMinutes: 60,
            isFixed: false,
            isOverdue: false,
            timerEligible: true,
          },
          {
            type: 'habit',
            occurrenceId: 2,
            habitId: 3,
            title: 'Joggen',
            status: HabitOccurrenceStatus.PENDING,
            scheduledDate: '2026-09-25',
            scheduleType: HabitScheduleType.INTERVAL,
            plannedDurationMinutes: null,
            isOverdue: false,
            timerEligible: true,
          },
        ],
      });

      serviceMock.getToday.mockResolvedValue(response);

      await expect(
        controller.getToday({
          id: '11111111-1111-4111-8111-111111111111',
          email: 'test@example.test',
        }),
      ).resolves.toEqual(response);

      expect(serviceMock.getToday).toHaveBeenCalledTimes(1);
    });

    it('returns an empty planner', async () => {
      const response = new DayPlannerResponseDto({
        date: '2026-09-25',
        items: [],
      });

      serviceMock.getToday.mockResolvedValue(response);

      await expect(
        controller.getToday({
          id: '11111111-1111-4111-8111-111111111111',
          email: 'test@example.test',
        }),
      ).resolves.toEqual(response);
    });
  });

  describe('getWeek', () => {
    it('answers the week of the caller from its Monday', async () => {
      const response = {
        startDate: '2026-11-16',
        endDate: '2026-11-22',
        today: '2026-11-17',
        days: [],
      };
      serviceMock.getWeek.mockResolvedValue(response);

      await expect(
        controller.getWeek(
          {
            id: '11111111-1111-4111-8111-111111111111',
            email: 'test@example.test',
          },
          { start: '2026-11-16' },
        ),
      ).resolves.toEqual(response);
      expect(serviceMock.getWeek).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        '2026-11-16',
      );
    });
  });
});
