import { Test, TestingModule } from '@nestjs/testing';
import { DayPlannerController } from './day-planner.controller';
import { DayPlannerService } from './day-planner.service';

describe('DayPlannerController', () => {
  let controller: DayPlannerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DayPlannerController],
      providers: [
        {
          provide: DayPlannerService,
          useValue: {
            getToday: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(DayPlannerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
