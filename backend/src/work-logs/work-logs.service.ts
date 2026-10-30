import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, EntityManager, Repository } from 'typeorm';
import { Clock } from '../common/clock';
import { assertDateOnly } from '../common/date/date-only.utils';
import { endOfDay, startOfDay } from '../common/date/local-day';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { ownedOccurrences } from '../habit-occurrences/owned-occurrences';
import { TodoEntity } from '../todos/entities/todo.entity';
import {
  CreateWorkLogDto,
  WorkDayResponse,
  WorkLogResponse,
  WorkLogTimesDto,
} from './work-log.dto';
import { WorkLogEntity } from './work-log.entity';
import { coveredMilliseconds } from './work-time';

const MINUTE_MS = 60_000;
const minutes = (milliseconds: number): number =>
  Math.round(milliseconds / MINUTE_MS);

@Injectable()
export class WorkLogsService {
  constructor(
    @InjectRepository(WorkLogEntity)
    private readonly logs: Repository<WorkLogEntity>,
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  /** A log belongs to the day it started on. */
  async day(userId: string, date: string): Promise<WorkDayResponse> {
    assertDateOnly(date);
    const logs = await this.logs.find({
      where: {
        userId,
        startedAt: Between(
          startOfDay(date),
          new Date(endOfDay(date).getTime() - 1),
        ),
      },
      order: { startedAt: 'ASC', id: 'ASC' },
    });
    return {
      date,
      totalMinutes: minutes(coveredMilliseconds(logs)),
      logs: logs.map((log) => this.response(log)),
    };
  }

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

  update(
    userId: string,
    id: number,
    dto: WorkLogTimesDto,
  ): Promise<WorkLogResponse> {
    const range = this.range(dto);
    return this.unitOfWork.run(userId, async (manager) => {
      const repository = manager.getRepository(WorkLogEntity);
      const log = await repository.findOneBy({ id, userId });
      if (!log)
        throw new NotFoundException(`Work log with ID ${id} was not found`);
      return this.response(await repository.save({ ...log, ...range }));
    });
  }

  async remove(userId: string, id: number): Promise<void> {
    const { affected } = await this.logs.delete({ id, userId });
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
      if (!todo) throw new NotFoundException('Todo nicht gefunden.');
      return todo.title;
    }
    const occurrence = await ownedOccurrences(manager, userId, { select: true })
      .andWhere('occurrence.id = :id', { id: dto.targetId })
      .getOne();
    if (!occurrence)
      throw new NotFoundException('Habit-Ausführung nicht gefunden.');
    return occurrence.habit.title;
  }

  private response(log: WorkLogEntity): WorkLogResponse {
    return {
      id: log.id,
      title: log.title,
      startedAt: log.startedAt.toISOString(),
      endedAt: log.endedAt.toISOString(),
      minutes: minutes(log.endedAt.getTime() - log.startedAt.getTime()),
      source: log.source,
    };
  }
}
