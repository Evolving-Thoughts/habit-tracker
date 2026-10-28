import { TodoResponseDto } from '../dto/todo-response.dto';
import { TodoEntity } from '../entities/todo.entity';
import { isTodoTimerEligible } from '../../timers/timer-target';

export class TodoMapper {
  static toResponseDto(todo: TodoEntity): TodoResponseDto {
    return new TodoResponseDto({
      id: todo.id,
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
