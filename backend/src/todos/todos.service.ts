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
import { Clock } from '../common/clock';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { releaseTimers } from '../timers/timer-target';

@Injectable()
export class TodosService {
  constructor(
    @InjectRepository(TodoEntity)
    private readonly todoRepository: Repository<TodoEntity>,
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  async findAll(userId: string): Promise<TodoEntity[]> {
    return this.todoRepository.find({
      where: { userId },
      order: { id: 'ASC' },
    });
  }

  async findOne(userId: string, id: number): Promise<TodoEntity> {
    const todo = await this.todoRepository.findOneBy({ id, userId });

    if (!todo) {
      throw new NotFoundException(`Todo with ID ${id} was not found`);
    }

    return todo;
  }

  async create(
    userId: string,
    createTodoDto: CreateTodoDto,
  ): Promise<TodoEntity> {
    const scheduledAt = createTodoDto.scheduledAt
      ? new Date(createTodoDto.scheduledAt)
      : null;

    const isFixed = createTodoDto.isFixed ?? false;

    this.validateScheduling(isFixed, scheduledAt);

    const todo = this.todoRepository.create({
      userId,
      title: createTodoDto.title,
      completed: false,
      completedAt: null,
      scheduledAt,
      plannedDurationMinutes: createTodoDto.plannedDurationMinutes ?? null,
      isFixed,
    });

    return this.todoRepository.save(todo);
  }

  async update(
    userId: string,
    id: number,
    updateTodoDto: UpdateTodoDto,
  ): Promise<TodoEntity> {
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

    return this.unitOfWork.run(userId, async (manager) => {
      const repository = manager.getRepository(TodoEntity);
      const todo = await repository.findOneBy({ id, userId });
      if (!todo)
        throw new NotFoundException(`Todo with ID ${id} was not found`);
      Object.assign(todo, changes);

      if (updateTodoDto.completed === true) {
        // Bei einem wiederholten PATCH mit completed=true
        // bleibt der ursprüngliche Zeitpunkt erhalten.
        todo.completedAt ??= this.clock.now();
      }

      if (updateTodoDto.completed === false) {
        todo.completedAt = null;
      }

      this.validateScheduling(todo.isFixed, todo.scheduledAt);

      const saved = await repository.save(todo);
      // A completed todo is no timer target any more.
      if (todo.completed)
        await releaseTimers(manager, userId, { todoIds: [id] });
      return saved;
    });
  }

  async remove(userId: string, id: number): Promise<void> {
    await this.unitOfWork.run(userId, async (manager) => {
      const repository = manager.getRepository(TodoEntity);
      const todo = await repository.findOneBy({ id, userId });
      if (!todo)
        throw new NotFoundException(`Todo with ID ${id} was not found`);
      await repository.softRemove(todo);
      await releaseTimers(manager, userId, { todoIds: [id] });
    });
  }

  private validateScheduling(isFixed: boolean, scheduledAt: Date | null): void {
    if (isFixed && scheduledAt === null) {
      throw new BadRequestException('A fixed todo requires a scheduled date');
    }
  }
}
