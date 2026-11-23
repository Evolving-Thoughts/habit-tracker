import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../auth/auth.entities';
import { TodoEntity } from '../todos/entities/todo.entity';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';

export type TimerState = 'running' | 'paused' | 'stopped';

/**
 * A stopwatch on one todo or habit occurrence. It counts up: the time of
 * finished stretches is stored, the running stretch starts at
 * `segmentStartedAt`. A target is optional and only marks a moment; the
 * stopwatch keeps running past it.
 */
@Entity('timers')
@Check('CHK_timer_state', `"state" IN ('running', 'paused', 'stopped')`)
@Check(
  'CHK_timer_target_minutes',
  '"targetMinutes" IS NULL OR "targetMinutes" BETWEEN 1 AND 10080',
)
@Check('CHK_timer_elapsed', '"elapsedMilliseconds" >= 0')
@Check('CHK_timer_idle', '"idleMilliseconds" >= 0')
@Check(
  'CHK_timer_segment',
  `("state" = 'running') = ("segmentStartedAt" IS NOT NULL)`,
)
@Check('CHK_timer_target', '("todoId" IS NULL) <> ("occurrenceId" IS NULL)')
@Index('UQ_timer_active_user', ['userId'], {
  unique: true,
  where: `"state" IN ('running', 'paused')`,
})
export class TimerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @Index()
  @Column({ type: 'uuid' })
  userId!: string;
  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;
  @Column({ type: 'integer', nullable: true })
  todoId!: number | null;
  @ManyToOne(() => TodoEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'todoId' })
  todo?: TodoEntity;
  @Column({ type: 'integer', nullable: true })
  occurrenceId!: number | null;
  @ManyToOne(() => HabitOccurrenceEntity, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'occurrenceId' })
  occurrence?: HabitOccurrenceEntity;
  @Column({ type: 'varchar', length: 200 })
  title!: string;
  @Column({ type: 'varchar', length: 16 })
  state!: TimerState;
  /** Planned minutes of the target when it has any; the stopwatch runs on. */
  @Column({ type: 'integer', nullable: true })
  targetMinutes!: number | null;
  /** Time of all finished stretches; the running one comes on top. */
  @Column({ type: 'integer', default: 0 })
  elapsedMilliseconds!: number;
  /**
   * Start of the running stretch; closed into a work log when it ends. A
   * stretch resumed within a minute of its pause starts where the block
   * before it started (`resumeWorkSegment`).
   */
  @Column({ type: 'timestamptz', nullable: true })
  segmentStartedAt!: Date | null;
  /** While paused: where the block of the last stretch started. */
  @Column({ type: 'timestamptz', nullable: true })
  blockStartedAt!: Date | null;
  /** While paused: when the last stretch ended. */
  @Column({ type: 'timestamptz', nullable: true })
  pausedAt!: Date | null;
  /**
   * The short pauses inside the current block. The block's log counts them
   * as worked; the stopwatch shows only the time it ran (`elapsedAt`).
   */
  @Column({ type: 'integer', default: 0 })
  idleMilliseconds!: number;
  /** The work log of the current block, once it is long enough to be one. */
  @Column({ type: 'integer', nullable: true })
  workLogId!: number | null;
  /** When a running stopwatch will reach its target; null once it has. */
  @Column({ type: 'timestamptz', nullable: true })
  targetReachesAt!: Date | null;
  /** When the target was reached; the notification hangs on this. */
  @Column({ type: 'timestamptz', nullable: true })
  targetReachedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true })
  pushHandledAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz', default: () => 'clock_timestamp()' })
  createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
