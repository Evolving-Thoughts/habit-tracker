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
export type TimerState = 'running' | 'paused' | 'finished' | 'stopped';
@Entity('timers')
@Check(
  'CHK_timer_state',
  `"state" IN ('running', 'paused', 'finished', 'stopped')`,
)
@Check('CHK_timer_duration', '"durationMinutes" BETWEEN 1 AND 10080')
@Check(
  'CHK_timer_remaining',
  '"remainingMilliseconds" BETWEEN 0 AND "durationMinutes" * 60000',
)
@Check('CHK_timer_deadline', `("state" = 'running') = ("endsAt" IS NOT NULL)`)
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
  @Column({ type: 'integer' })
  durationMinutes!: number;
  @Column({ type: 'integer' })
  remainingMilliseconds!: number;
  @Column({ type: 'timestamptz', nullable: true })
  endsAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz', default: () => 'clock_timestamp()' })
  createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
