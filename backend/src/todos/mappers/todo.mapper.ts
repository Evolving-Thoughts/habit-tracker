import { TodoResponseDto } from '../dto/todo-response.dto';
import { TodoEntity } from '../entities/todo.entity';
import { isTodoTimerEligible } from '../../timers/timer-target';
import { TodoAncestry } from '../todo-ancestry';

export class TodoMapper {
  static toResponseDto(
    todo: TodoEntity,
    ancestry: TodoAncestry,
  ): TodoResponseDto {
    return new TodoResponseDto({
      id: todo.id,
      parentId: todo.parentId ?? null,
      categoryId: todo.categoryId ?? null,
      periodStart: todo.periodStart ?? null,
      periodEnd: todo.periodEnd ?? null,
      goalHabitId: todo.goalHabitId ?? null,
      goalTarget: todo.goalTarget ?? null,
      why: todo.why ?? null,
      inheritedWhy: ancestry.inheritedWhy(todo),
      title: todo.title,
      completed: todo.completed,
      completedAt: todo.completedAt?.toISOString() ?? null,
      scheduledDate: todo.scheduledDate ?? null,
      timeOfDay: todo.timeOfDay ?? null,
      plannedDurationMinutes: todo.plannedDurationMinutes,
      timerEligible: isTodoTimerEligible(todo),
    });
  }
}
