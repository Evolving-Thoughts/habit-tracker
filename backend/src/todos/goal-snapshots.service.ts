import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Clock } from '../common/clock';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { TodoEntity } from './entities/todo.entity';
import { GoalScope, scopesByRoot } from './goal-scope';
import { GoalSnapshotEntity } from './goal-snapshot.entity';

const HOUR_MS = 3_600_000;

export type BurnupPoint = {
  date: string;
  doneCount: number;
  totalCount: number;
  doneMinutes: number;
  totalMinutes: number;
};

@Injectable()
export class GoalSnapshotsService implements OnModuleInit, OnModuleDestroy {
  private interval?: NodeJS.Timeout;
  private readonly logger = new Logger('GoalSnapshots');

  constructor(
    @InjectRepository(TodoEntity)
    private readonly todos: Repository<TodoEntity>,
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  /** Keeps today's row current, so a day without a visit still has a value. */
  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.interval = setInterval(() => void this.recordAll(), HOUR_MS);
    this.interval.unref();
    void this.recordAll();
  }

  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval);
  }

  private async recordAll(): Promise<void> {
    try {
      const owners = await this.todos
        .createQueryBuilder('todo')
        .select('DISTINCT "todo"."userId"', 'userId')
        .getRawMany<{ userId: string }>();
      for (const { userId } of owners) await this.record(userId);
    } catch {
      this.logger.warn('Snapshots konnten nicht gespeichert werden.');
    }
  }

  /** Today's value of every campaign of the user, from its todos. */
  private async scopes(
    manager: EntityManager,
    userId: string,
  ): Promise<GoalScope[]> {
    return scopesByRoot(
      await manager.getRepository(TodoEntity).findBy({ userId }),
    );
  }

  /** Replaces today's value under the user lock. */
  record(userId: string): Promise<void> {
    return this.unitOfWork.run(userId, (manager) =>
      this.store(manager, userId, this.clock.today()),
    );
  }

  /** Replaces the day's value; earlier days are never rewritten. */
  private async store(
    manager: EntityManager,
    userId: string,
    date: string,
  ): Promise<void> {
    const scopes = await this.scopes(manager, userId);
    if (!scopes.length) return;
    await manager.getRepository(GoalSnapshotEntity).upsert(
      scopes.map((scope) => ({ ...scope, userId, date })),
      ['rootTodoId', 'date'],
    );
  }

  /** Whether the day's stored values already match the todos. */
  private async recorded(
    manager: EntityManager,
    userId: string,
    date: string,
  ): Promise<boolean> {
    const stored = new Map(
      (
        await manager.getRepository(GoalSnapshotEntity).findBy({ userId, date })
      ).map((row) => [row.rootTodoId, row]),
    );
    return (await this.scopes(manager, userId)).every((scope) => {
      const row = stored.get(scope.rootTodoId);
      return (
        row !== undefined &&
        row.doneCount === scope.doneCount &&
        row.totalCount === scope.totalCount &&
        row.doneMinutes === scope.doneMinutes &&
        row.totalMinutes === scope.totalMinutes
      );
    });
  }

  /**
   * The campaign's history, today's value included. Decides in a lock-free
   * read whether today's values are stored as they are; usually they are,
   * and the answer comes from that snapshot without the user lock. Otherwise
   * today's values are stored under the lock and the answer is read there.
   */
  async burnup(userId: string, id: number): Promise<BurnupPoint[]> {
    const today = this.clock.today();
    const asStored = await this.unitOfWork.read(async (manager) =>
      (await this.recorded(manager, userId, today))
        ? { points: await this.points(manager, userId, id) }
        : null,
    );
    if (asStored) return asStored.points;
    return this.unitOfWork.run(userId, async (manager) => {
      await this.store(manager, userId, today);
      return this.points(manager, userId, id);
    });
  }

  /** The stored values of one campaign, oldest first. */
  private async points(
    manager: EntityManager,
    userId: string,
    id: number,
  ): Promise<BurnupPoint[]> {
    const todo = await manager
      .getRepository(TodoEntity)
      .findOneBy({ id, userId });
    if (!todo) throw new NotFoundException(`Todo with ID ${id} was not found`);
    if (todo.parentId !== null)
      throw new BadRequestException('Den Burn-up gibt es nur für Kampagnen.');
    const rows = await manager.getRepository(GoalSnapshotEntity).find({
      where: { userId, rootTodoId: id },
      order: { date: 'ASC' },
    });
    return rows.map(
      ({ date, doneCount, totalCount, doneMinutes, totalMinutes }) => ({
        date,
        doneCount,
        totalCount,
        doneMinutes,
        totalMinutes,
      }),
    );
  }
}
