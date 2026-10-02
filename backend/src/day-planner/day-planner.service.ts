import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import {
  DEFAULT_TIME_ZONE,
  getCurrentDateInTimeZone,
} from '../common/date/date-only.utils';
import {
  DayPlannerHabitItemDto,
  DayPlannerItemDto,
  DayPlannerResponseDto,
  DayPlannerTodoItemDto,
} from './dto/day-planner-response.dto';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { HabitOccurrenceGeneratorService } from '../habit-occurrences/habit-occurrence-generator.service';
import { TodoEntity } from '../todos/entities/todo.entity';

@Injectable()
export class DayPlannerService {
  constructor(
    @InjectRepository(TodoEntity)
    private readonly todoRepository: Repository<TodoEntity>,

    private readonly occurrenceGenerator: HabitOccurrenceGeneratorService,
  ) {}

  async getToday(): Promise<DayPlannerResponseDto> {
    const today = getCurrentDateInTimeZone();

    const [todos, occurrences] = await Promise.all([
      this.findTodosForToday(today),
      this.occurrenceGenerator.generateToday(),
    ]);

    const todoItems = todos.map((todo) => this.mapTodo(todo, today));

    const habitItems = occurrences.map((occurrence) =>
      this.mapHabitOccurrence(occurrence, today),
    );

    const items = this.sortItems([...todoItems, ...habitItems]);

    return new DayPlannerResponseDto({
      date: today,
      items,
    });
  }

  private findTodosForToday(today: string): Promise<TodoEntity[]> {
    return this.todoRepository
      .createQueryBuilder('todo')
      .where('todo.scheduledAt IS NOT NULL')
      .andWhere(
        new Brackets((queryBuilder) => {
          queryBuilder
            .where(
              `(
                todo.completed = false
                AND DATE(
                  todo.scheduledAt
                  AT TIME ZONE :timeZone
                ) <= :today
              )`,
              {
                timeZone: DEFAULT_TIME_ZONE,
                today,
              },
            )
            .orWhere(
              `(
                todo.completed = true
                AND DATE(
                  todo.completedAt
                  AT TIME ZONE :timeZone
                ) = :today
              )`,
              {
                timeZone: DEFAULT_TIME_ZONE,
                today,
              },
            );
        }),
      )
      .orderBy('todo.scheduledAt', 'ASC')
      .addOrderBy('todo.id', 'ASC')
      .getMany();
  }

  private mapTodo(todo: TodoEntity, today: string): DayPlannerTodoItemDto {
    if (todo.scheduledAt === null) {
      throw new Error(`Scheduled todo ${todo.id} has no scheduledAt`);
    }

    const scheduledDate = getCurrentDateInTimeZone(
      DEFAULT_TIME_ZONE,
      todo.scheduledAt,
    );

    return {
      type: 'todo',
      todoId: todo.id,
      title: todo.title,
      status: todo.completed ? 'completed' : 'pending',
      scheduledDate,
      scheduledAt: todo.scheduledAt.toISOString(),
      completedAt: todo.completedAt?.toISOString() ?? null,
      plannedDurationMinutes: todo.plannedDurationMinutes,
      isFixed: todo.isFixed,
      isOverdue: !todo.completed && scheduledDate < today,
    };
  }

  private mapHabitOccurrence(
    occurrence: HabitOccurrenceEntity,
    today: string,
  ): DayPlannerHabitItemDto {
    if (!occurrence.habit) {
      throw new Error(
        `Habit occurrence ${occurrence.id} has no habit relation`,
      );
    }

    return {
      type: 'habit',
      occurrenceId: occurrence.id,
      habitId: occurrence.habitId,
      title: occurrence.habit.title,
      status: occurrence.status,
      scheduledDate: occurrence.scheduledDate,
      scheduleType: occurrence.habit.scheduleType,
      isOverdue:
        occurrence.status === HabitOccurrenceStatus.PENDING &&
        occurrence.scheduledDate < today,
    };
  }

  private sortItems(items: DayPlannerItemDto[]): DayPlannerItemDto[] {
    return [...items].sort((first, second) => {
      const dateComparison = first.scheduledDate.localeCompare(
        second.scheduledDate,
      );

      if (dateComparison !== 0) {
        return dateComparison;
      }

      const firstSortValue =
        first.type === 'todo'
          ? first.scheduledAt
          : `${first.scheduledDate}T00:00:00.000Z`;

      const secondSortValue =
        second.type === 'todo'
          ? second.scheduledAt
          : `${second.scheduledDate}T00:00:00.000Z`;

      return firstSortValue.localeCompare(secondSortValue);
    });
  }
}
