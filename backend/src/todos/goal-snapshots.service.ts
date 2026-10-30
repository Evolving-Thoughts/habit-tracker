import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clock } from '../common/clock';
import { TodoEntity } from './entities/todo.entity';
import { scopesByRoot } from './goal-scope';
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
    @InjectRepository(GoalSnapshotEntity)
    private readonly snapshots: Repository<GoalSnapshotEntity>,
    @InjectRepository(TodoEntity)
    private readonly todos: Repository<TodoEntity>,
    private readonly clock: Clock,
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

  /** Replaces today's value; earlier days are never rewritten. */
  async record(userId: string): Promise<void> {
    const date = this.clock.today();
    const scopes = scopesByRoot(await this.todos.findBy({ userId }));
    if (!scopes.length) return;
    await this.snapshots.upsert(
      scopes.map((scope) => ({ ...scope, userId, date })),
      ['rootTodoId', 'date'],
    );
  }

  async burnup(userId: string, id: number): Promise<BurnupPoint[]> {
    const todo = await this.todos.findOneBy({ id, userId });
    if (!todo) throw new NotFoundException(`Todo with ID ${id} was not found`);
    if (todo.parentId !== null)
      throw new BadRequestException(
        'Burnup gibt es nur für Todos ohne übergeordnetes Todo.',
      );
    await this.record(userId);
    const rows = await this.snapshots.find({
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
