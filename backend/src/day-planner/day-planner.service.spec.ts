import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HabitOccurrenceGeneratorService } from '../habit-occurrences/habit-occurrence-generator.service';
import { TodoEntity } from '../todos/entities/todo.entity';
import { DayPlannerService } from './day-planner.service';

describe('DayPlannerService', () => {
  let service: DayPlannerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DayPlannerService,
        {
          provide: getRepositoryToken(TodoEntity),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: HabitOccurrenceGeneratorService,
          useValue: {
            generateToday: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(DayPlannerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
