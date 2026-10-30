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

export type WorkLogSource = 'timer' | 'manual';

/**
 * One stretch of actual work. Targets are plain ids and the title is copied,
 * so a log survives whatever later happens to its todo or habit.
 */
@Entity({ name: 'work_logs' })
@Check('CHK_work_log_target', '("todoId" IS NULL) <> ("occurrenceId" IS NULL)')
@Check('CHK_work_log_range', '"endedAt" > "startedAt"')
@Index(['userId', 'startedAt'])
export class WorkLogEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @Column({ type: 'integer', nullable: true })
  todoId!: number | null;

  @Column({ type: 'integer', nullable: true })
  occurrenceId!: number | null;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz' })
  endedAt!: Date;

  @Column({ type: 'varchar', length: 16 })
  source!: WorkLogSource;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
