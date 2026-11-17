import { UserEntity } from '../../auth/auth.entities';
import { CategoryEntity } from '../../categories/category.entity';
import {
  Check,
  Column,
  Index,
  JoinColumn,
  ManyToOne,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'todos' })
@Check(
  'CHK_todos_time_needs_date',
  '"timeOfDay" IS NULL OR "scheduledDate" IS NOT NULL',
)
export class TodoEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @PrimaryGeneratedColumn()
  id!: number;

  @Index('IDX_todos_parent')
  @Column({ type: 'integer', nullable: true })
  parentId!: number | null;

  @ManyToOne(() => TodoEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parentId', foreignKeyConstraintName: 'FK_todos_parent' })
  parent?: TodoEntity | null;

  @Index()
  @Column({ type: 'integer', nullable: true })
  categoryId!: number | null;

  @ManyToOne(() => CategoryEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category?: CategoryEntity | null;

  /** Optional time horizon, such as a month or a quarter. */
  @Column({ type: 'date', nullable: true })
  periodStart!: string | null;

  @Column({ type: 'date', nullable: true })
  periodEnd!: string | null;

  /** A habit whose completions in the period count towards `goalTarget`. */
  @Column({ type: 'integer', nullable: true })
  goalHabitId!: number | null;

  @Column({ type: 'integer', nullable: true })
  goalTarget!: number | null;

  /** The personal reason for this entry. */
  @Column({ type: 'varchar', length: 1000, nullable: true })
  why!: string | null;

  @Column({
    type: 'varchar',
    length: 200,
  })
  title!: string;

  @Column({
    type: 'boolean',
    default: false,
  })
  completed!: boolean;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  completedAt!: Date | null;

  /** The day the todo is planned for; null while it is in the backlog. */
  @Index('IDX_todos_scheduled_date')
  @Column({ type: 'date', nullable: true })
  scheduledDate!: string | null;

  /**
   * Start as HH:mm in local time. Only an appointment has one: it is fixed
   * to that time, while every other planned todo just has its day.
   */
  @Column({ type: 'varchar', length: 5, nullable: true })
  timeOfDay!: string | null;

  /** Place in the order of its day, set by sorting; null sorts last. */
  @Column({ type: 'integer', nullable: true })
  dayPosition!: number | null;

  @Column({
    type: 'integer',
    nullable: true,
  })
  plannedDurationMinutes!: number | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;

  @DeleteDateColumn({
    type: 'timestamptz',
    nullable: true,
  })
  deletedAt!: Date | null;
}
