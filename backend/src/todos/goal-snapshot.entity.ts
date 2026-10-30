import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserEntity } from '../auth/auth.entities';

/** A root todo's scope on one day: the only history burnup charts rely on. */
@Entity({ name: 'goal_snapshots' })
@Unique('UQ_goal_snapshot_root_date', ['rootTodoId', 'date'])
export class GoalSnapshotEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @Column({ type: 'integer' })
  rootTodoId!: number;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'integer' })
  doneCount!: number;

  @Column({ type: 'integer' })
  totalCount!: number;

  @Column({ type: 'integer' })
  doneMinutes!: number;

  /** Sum of the known durations; todos without one add nothing. */
  @Column({ type: 'integer' })
  totalMinutes!: number;
}
