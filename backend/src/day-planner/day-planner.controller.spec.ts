import { Test, TestingModule } from '@nestjs/testing';
import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitScheduleType } from '../habits/enums/habit-schedule-type.enum';
import { DayPlannerController } from './day-planner.controller';
import { DayPlannerService } from './day-planner.service';
import { DayPlannerResponseDto } from './dto/day-planner-response.dto';

type DayPlannerServiceMock = {
  getToday: jest.MockedFunction<() => Promise<DayPlannerResponseDto>>;
};

describe('DayPlannerController', () => {
  let controller: DayPlannerController;
  let serviceMock: DayPlannerServiceMock;

  beforeEach(async () => {
    serviceMock = {
      getToday: jest.fn(),
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
          },
          {
            type: 'habit',
            occurrenceId: 2,
            habitId: 3,
            title: 'Joggen',
            status: HabitOccurrenceStatus.PENDING,
            scheduledDate: '2026-09-25',
            scheduleType: HabitScheduleType.INTERVAL,
            isOverdue: false,
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
});
