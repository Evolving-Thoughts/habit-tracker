import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CalendarSyncService } from '../calendar/calendar-sync.service';
import { Clock } from '../common/clock';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { ownedOccurrences } from '../habit-occurrences/owned-occurrences';
import { TodoEntity } from '../todos/entities/todo.entity';
import {
  CreateWorkLogDto,
  WorkLogResponse,
  WorkLogTimesDto,
} from './work-log.dto';
import { WorkLogEntity } from './work-log.entity';
import { lengthInMinutes } from './work-time';

@Injectable()
export class WorkLogsService {
  constructor(
    private readonly calendar: CalendarSyncService,
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  create(userId: string, dto: CreateWorkLogDto): Promise<WorkLogResponse> {
    const range = this.range(dto);
    return this.unitOfWork.run(userId, async (manager) => {
      const title = await this.targetTitle(manager, userId, dto);
      const repository = manager.getRepository(WorkLogEntity);
      const log = await repository.save(
        repository.create({
          userId,
          todoId: dto.kind === 'todo' ? dto.targetId : null,
          occurrenceId: dto.kind === 'occurrence' ? dto.targetId : null,
          title,
          source: 'manual',
          ...range,
        }),
      );
      return this.response(log);
    });
  }

  async update(
    userId: string,
    id: number,
    dto: WorkLogTimesDto,
  ): Promise<WorkLogResponse> {
    const range = this.range(dto);
    const result = await this.unitOfWork.run(userId, async (manager) => {
      const repository = manager.getRepository(WorkLogEntity);
      const log = await repository.findOneBy({ id, userId });
      if (!log)
        throw new NotFoundException(`Work log with ID ${id} was not found`);
      return this.response(await repository.save({ ...log, ...range }));
    });
    void this.calendar
      .syncUser(userId)
      .catch(() =>
        new Logger(WorkLogsService.name).warn(
          'Kalenderkorrektur wird beim nächsten Abgleich wiederholt.',
        ),
      );
    return result;
  }

  /** Deletes a log in the user's unit of work, like every other change of it. */
  async remove(userId: string, id: number): Promise<void> {
    const { affected } = await this.unitOfWork.run(userId, (manager) =>
      manager.getRepository(WorkLogEntity).delete({ id, userId }),
    );
    if (!affected)
      throw new NotFoundException(`Work log with ID ${id} was not found`);
  }

  private range(dto: WorkLogTimesDto): { startedAt: Date; endedAt: Date } {
    const startedAt = new Date(dto.startedAt);
    const endedAt = new Date(dto.endedAt);
    if (endedAt <= startedAt)
      throw new BadRequestException('Das Ende muss nach dem Start liegen.');
    if (endedAt > this.clock.now())
      throw new BadRequestException(
        'Das Ende darf nicht in der Zukunft liegen.',
      );
    return { startedAt, endedAt };
  }

  private async targetTitle(
    manager: EntityManager,
    userId: string,
    dto: CreateWorkLogDto,
  ): Promise<string> {
    if (dto.kind === 'todo') {
      const todo = await manager
        .getRepository(TodoEntity)
        .findOneBy({ id: dto.targetId, userId });
      if (!todo) throw new NotFoundException('Quest nicht gefunden.');
      return todo.title;
    }
    const occurrence = await ownedOccurrences(manager, userId, { select: true })
      .andWhere('occurrence.id = :id', { id: dto.targetId })
      .getOne();
    if (!occurrence)
      throw new NotFoundException('Daily-Ausführung nicht gefunden.');
    return occurrence.habit.title;
  }

  private response(log: WorkLogEntity): WorkLogResponse {
    return {
      id: log.id,
      title: log.title,
      startedAt: log.startedAt.toISOString(),
      endedAt: log.endedAt.toISOString(),
      minutes: lengthInMinutes(log),
      source: log.source,
    };
  }
}
