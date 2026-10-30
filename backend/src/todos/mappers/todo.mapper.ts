import { TodoResponseDto } from '../dto/todo-response.dto';
import { TodoEntity } from '../entities/todo.entity';
import { isTodoTimerEligible } from '../../timers/timer-target';

export class TodoMapper {
  static toResponseDto(todo: TodoEntity): TodoResponseDto {
    return new TodoResponseDto({
      id: todo.id,
      parentId: todo.parentId ?? null,
      categoryId: todo.categoryId ?? null,
      periodStart: todo.periodStart ?? null,
      periodEnd: todo.periodEnd ?? null,
      goalHabitId: todo.goalHabitId ?? null,
      goalTarget: todo.goalTarget ?? null,
      why: todo.why ?? null,
      title: todo.title,
      completed: todo.completed,
      completedAt: todo.completedAt?.toISOString() ?? null,
      scheduledAt: todo.scheduledAt?.toISOString() ?? null,
      plannedDurationMinutes: todo.plannedDurationMinutes,
      isFixed: todo.isFixed,
      timerEligible: isTodoTimerEligible(todo),
    });
  }
}
