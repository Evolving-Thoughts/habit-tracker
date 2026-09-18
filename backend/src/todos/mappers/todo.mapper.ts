import { TodoResponseDto } from '../dto/todo-response.dto';
import { TodoEntity } from '../entities/todo.entity';

export class TodoMapper {
  static toResponseDto(todo: TodoEntity): TodoResponseDto {
    return new TodoResponseDto({
      id: todo.id,
      title: todo.title,
      completed: todo.completed,
      scheduledAt: todo.scheduledAt?.toISOString() ?? null,
      plannedDurationMinutes: todo.plannedDurationMinutes,
      isFixed: todo.isFixed,
    });
  }
}
