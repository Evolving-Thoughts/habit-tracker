import { TodoResponseDto } from '../dto/todo-response.dto';
import { TodoEntity } from '../entities/todo.entity';
import { isTodoTimerEligible } from '../../timers/timer-target';
import { WhySources } from '../why-sources';

export class TodoMapper {
  static toResponseDto(todo: TodoEntity, why: WhySources): TodoResponseDto {
    return new TodoResponseDto({
      id: todo.id,
      parentId: todo.parentId ?? null,
      categoryId: todo.categoryId ?? null,
      periodStart: todo.periodStart ?? null,
      periodEnd: todo.periodEnd ?? null,
      goalHabitId: todo.goalHabitId ?? null,
      goalTarget: todo.goalTarget ?? null,
      why: todo.why ?? null,
      inheritedWhy: why.forTodo(todo),
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
