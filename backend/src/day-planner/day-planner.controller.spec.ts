import { Test, TestingModule } from '@nestjs/testing';
import { DayPlannerController } from './day-planner.controller';
import { DayPlannerService } from './day-planner.service';
import { DayPlannerResponseDto } from './dto/day-planner-response.dto';
import { WeekPlanResponseDto } from './dto/week-plan.dto';

type DayPlannerServiceMock = {
  getToday: jest.MockedFunction<() => Promise<DayPlannerResponseDto>>;
  getPlan: jest.MockedFunction<
    (userId: string, from: string, days: number) => Promise<WeekPlanResponseDto>
  >;
};

describe('DayPlannerController', () => {
  let controller: DayPlannerController;
  let serviceMock: DayPlannerServiceMock;

  beforeEach(async () => {
    serviceMock = {
      getToday: jest.fn(),
      getPlan: jest.fn(),
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
        items: [],
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

  describe('getPlan', () => {
    it('answers the days the caller asked for', async () => {
      const response = {
        startDate: '2026-11-17',
        endDate: '2026-11-20',
        today: '2026-11-17',
        days: [],
        overdue: [],
      };
      serviceMock.getPlan.mockResolvedValue(response);

      await expect(
        controller.getPlan(
          {
            id: '11111111-1111-4111-8111-111111111111',
            email: 'test@example.test',
          },
          { from: '2026-11-17', days: 4 },
        ),
      ).resolves.toEqual(response);
      expect(serviceMock.getPlan).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        '2026-11-17',
        4,
      );
    });
  });
});
