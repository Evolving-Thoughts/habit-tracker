import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import {
  DEFAULT_TIME_ZONE,
  getCurrentDateInTimeZone,
} from '../common/date/date-only.utils';
import { HabitSchedulingService } from '../habits/scheduling/habit-scheduling.service';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import { HabitOccurrenceStatus } from '../habit-occurrences/enums/habit-occurrence-status.enum';
import { TodoEntity } from '../todos/entities/todo.entity';
import {
  DayPlannerHabitItemDto,
  DayPlannerResponseDto,
  DayPlannerTodoItemDto,
} from './dto/day-planner-response.dto';

@Injectable()
export class DayPlannerService {
  constructor(
    @InjectRepository(TodoEntity)
    private readonly todoRepository: Repository<TodoEntity>,
    private readonly scheduling: HabitSchedulingService,
  ) {}

  async getToday(): Promise<DayPlannerResponseDto> {
    const today = getCurrentDateInTimeZone();

    const [todos, occurrences] = await Promise.all([
      this.findTodosForToday(today),
      this.scheduling.getToday(),
    ]);

    const items = [
      ...todos.map((todo) => this.mapTodo(todo, today)),
      ...occurrences.map((occurrence) => this.mapOccurrence(occurrence, today)),
    ];

    items.sort((first, second) => {
      const dateComparison = first.scheduledDate.localeCompare(
        second.scheduledDate,
      );

      if (dateComparison !== 0) {
        return dateComparison;
      }

      const firstTime =
        first.type === 'todo'
          ? first.scheduledAt
          : `${first.scheduledDate}T00:00:00.000Z`;

      const secondTime =
        second.type === 'todo'
          ? second.scheduledAt
          : `${second.scheduledDate}T00:00:00.000Z`;

      return firstTime.localeCompare(secondTime);
    });

    return new DayPlannerResponseDto({ date: today, items });
  }

  private findTodosForToday(today: string): Promise<TodoEntity[]> {
    return this.todoRepository
      .createQueryBuilder('todo')
      .where('"todo"."scheduledAt" IS NOT NULL')
      .andWhere(
        new Brackets((query) => {
          query
            .where(
              `"todo"."completed" = false
               AND DATE(
                 "todo"."scheduledAt" AT TIME ZONE :timeZone
               ) <= :today`,
              { timeZone: DEFAULT_TIME_ZONE, today },
            )
            .orWhere(
              `"todo"."completed" = true
               AND DATE(
                 "todo"."completedAt" AT TIME ZONE :timeZone
               ) = :today`,
              { timeZone: DEFAULT_TIME_ZONE, today },
            );
        }),
      )
      .orderBy('"todo"."scheduledAt"', 'ASC')
      .addOrderBy('"todo"."id"', 'ASC')
      .getMany();
  }

  private mapTodo(todo: TodoEntity, today: string): DayPlannerTodoItemDto {
    if (todo.scheduledAt === null) {
      throw new Error('Expected a scheduled todo');
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

  private mapOccurrence(
    occurrence: HabitOccurrenceEntity,
    today: string,
  ): DayPlannerHabitItemDto {
    if (!occurrence.habit || !occurrence.scheduleVersion) {
      throw new Error('Missing occurrence relations');
    }

    return {
      type: 'habit',
      occurrenceId: occurrence.id,
      habitId: occurrence.habitId,
      title: occurrence.habit.title,
      status: occurrence.status,
      scheduledDate: occurrence.scheduledDate,
      scheduleType: occurrence.scheduleVersion.type,
      isOverdue:
        occurrence.status === HabitOccurrenceStatus.PENDING &&
        occurrence.scheduledDate < today,
    };
  }
}
