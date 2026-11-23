import { UserEntity } from '../../auth/auth.entities';
import { CategoryEntity } from '../../categories/category.entity';
import { TodoEntity } from '../../todos/entities/todo.entity';
import type { FocusBlockOverride } from '../../focus-blocks/focus-block-rules';
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

@Entity({ name: 'habits' })
@Check(
  'CHK_habits_focus_block',
  `"focusBlock" IN ('default', 'always', 'never')`,
)
export class HabitEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @Column({ type: 'integer', nullable: true })
  plannedDurationMinutes!: number | null;

  /** Fixed start as HH:mm in local time; null when only the day is planned. */
  @Column({ type: 'varchar', length: 5, nullable: true })
  timeOfDay!: string | null;

  /** Fokus-Sperre: the default rule, always or never (focus-block-rules.ts). */
  @Column({ type: 'varchar', length: 8, default: 'default' })
  focusBlock!: FocusBlockOverride;

  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'integer', nullable: true })
  categoryId!: number | null;

  @ManyToOne(() => CategoryEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category?: CategoryEntity | null;

  /**
   * The campaign the daily works towards: a top-level todo. Its reason is
   * inherited and the daily's measured time counts as its quest time
   * (`todo-ancestry.ts`). Todos are soft-deleted, so a deleted campaign stays
   * referenced here and simply stops counting; the FK only guards hard deletes.
   */
  @Index('IDX_habits_campaignId')
  @Column({ type: 'integer', nullable: true })
  campaignId!: number | null;

  @ManyToOne(() => TodoEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'campaignId',
    foreignKeyConstraintName: 'FK_habits_campaign',
  })
  campaign?: TodoEntity | null;

  /** The personal reason for this entry. */
  @Column({ type: 'varchar', length: 1000, nullable: true })
  why!: string | null;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
