import { UserEntity } from '../../auth/auth.entities';
import { CategoryEntity } from '../../categories/category.entity';
import type { CampaignColor, CampaignIcon } from '../campaign-style';
import type { NotesDocument } from '../todo-notes';
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

@Entity({ name: 'todos' })
@Check(
  'CHK_todos_time_needs_date',
  '"timeOfDay" IS NULL OR "scheduledDate" IS NOT NULL',
)
@Check(
  'CHK_todos_campaign_fields',
  '"parentId" IS NULL OR ("weeklyTargetMinutes" IS NULL AND "color" IS NULL AND "icon" IS NULL)',
)
@Check(
  'CHK_todos_weekly_target',
  '"weeklyTargetMinutes" IS NULL OR "weeklyTargetMinutes" BETWEEN 1 AND 6000',
)
@Check(
  'CHK_todos_focus_block',
  `"focusBlock" IN ('default', 'always', 'never')`,
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

  /**
   * Campaign only: minutes of quest time to reach each week, a colour and
   * an icon (keys from campaign-style.ts).
   */
  @Column({ type: 'integer', nullable: true })
  weeklyTargetMinutes!: number | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  color!: CampaignColor | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  icon!: CampaignIcon | null;

  /** The personal reason for this entry. */
  @Column({ type: 'varchar', length: 1000, nullable: true })
  why!: string | null;

  @Column({
    type: 'varchar',
    length: 200,
  })
  title!: string;

  /**
   * Rich-text notes as an editor document (see todo-notes.ts). Not selected
   * by default: lists of todos never carry everybody's notes along.
   */
  @Column({ type: 'jsonb', nullable: true, select: false })
  notes?: NotesDocument | null;

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

  /**
   * Place in the Questlog's order while the todo has no day, set when it
   * enters the backlog and by sorting; null sorts last.
   */
  @Column({ type: 'integer', nullable: true })
  backlogPosition!: number | null;

  @Column({
    type: 'integer',
    nullable: true,
  })
  plannedDurationMinutes!: number | null;

  /**
   * Kampagnen-Board (campaign-board.md): when the quest was last put back out
   * of "In Arbeit"; only work after it counts as in progress.
   */
  @Column({ type: 'timestamptz', nullable: true })
  setAsideAt!: Date | null;

  /**
   * When the user last took the quest into "In Arbeit" by hand; it counts
   * like work, until the quest is set aside again.
   */
  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  /** The user's "Geblockt" marker; starting a stopwatch or completing clears it. */
  @Column({ type: 'boolean', default: false })
  blocked!: boolean;

  /** Fokus-Sperre: the default rule, always or never (focus-block-rules.ts). */
  @Column({ type: 'varchar', length: 8, default: 'default' })
  focusBlock!: FocusBlockOverride;

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
