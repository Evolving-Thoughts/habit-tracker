import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { TodoEntity } from './entities/todo.entity';

@Injectable()
export class TodosService {
  constructor(
    @InjectRepository(TodoEntity)
    private readonly todoRepository: Repository<TodoEntity>,
  ) {}

  async findAll(): Promise<TodoEntity[]> {
    return this.todoRepository.find();
  }

  async findOne(id: number): Promise<TodoEntity> {
    const todo = await this.todoRepository.findOneBy({ id });

    if (!todo) {
      throw new NotFoundException(`Todo with ID ${id} was not found`);
    }

    return todo;
  }

  async create(createTodoDto: CreateTodoDto): Promise<TodoEntity> {
    const scheduledAt = createTodoDto.scheduledAt
      ? new Date(createTodoDto.scheduledAt)
      : null;

    const isFixed = createTodoDto.isFixed ?? false;

    this.validateScheduling(isFixed, scheduledAt);

    const todo = this.todoRepository.create({
      title: createTodoDto.title,
      completed: false,
      completedAt: null,
      scheduledAt,
      plannedDurationMinutes: createTodoDto.plannedDurationMinutes ?? null,
      isFixed,
    });

    return this.todoRepository.save(todo);
  }

  async update(id: number, updateTodoDto: UpdateTodoDto): Promise<TodoEntity> {
    const hasChanges = Object.values(updateTodoDto).some(
      (value) => value !== undefined,
    );

    if (!hasChanges) {
      throw new BadRequestException('At least one property must be provided');
    }

    const changes: DeepPartial<TodoEntity> = {
      id,
    };

    if (updateTodoDto.title !== undefined) {
      changes.title = updateTodoDto.title;
    }

    if (updateTodoDto.completed !== undefined) {
      changes.completed = updateTodoDto.completed;
    }

    if (updateTodoDto.scheduledAt !== undefined) {
      changes.scheduledAt =
        updateTodoDto.scheduledAt === null
          ? null
          : new Date(updateTodoDto.scheduledAt);
    }

    if (updateTodoDto.plannedDurationMinutes !== undefined) {
      changes.plannedDurationMinutes = updateTodoDto.plannedDurationMinutes;
    }

    if (updateTodoDto.isFixed !== undefined) {
      changes.isFixed = updateTodoDto.isFixed;
    }

    const todo = await this.todoRepository.preload(changes);

    if (!todo) {
      throw new NotFoundException(`Todo with ID ${id} was not found`);
    }

    if (updateTodoDto.completed === true) {
      // Bei einem wiederholten PATCH mit completed=true
      // bleibt der ursprüngliche Zeitpunkt erhalten.
      todo.completedAt ??= new Date();
    }

    if (updateTodoDto.completed === false) {
      todo.completedAt = null;
    }

    this.validateScheduling(todo.isFixed, todo.scheduledAt);

    return this.todoRepository.save(todo);
  }

  async remove(id: number): Promise<void> {
    const todo = await this.findOne(id);

    await this.todoRepository.softRemove(todo);
  }

  private validateScheduling(isFixed: boolean, scheduledAt: Date | null): void {
    if (isFixed && scheduledAt === null) {
      throw new BadRequestException('A fixed todo requires a scheduled date');
    }
  }
}
