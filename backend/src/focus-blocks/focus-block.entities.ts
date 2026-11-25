import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../auth/auth.entities';
import { TodoEntity } from '../todos/entities/todo.entity';
import { HabitOccurrenceEntity } from '../habit-occurrences/entities/habit-occurrence.entity';
import {
  DEFAULT_THRESHOLD_MINUTES,
  type FocusBlockMode,
  type FocusEndReason,
  type FocusEntryKind,
  type FocusList,
  type FocusListMode,
  type FocusTriggerKind,
} from './focus-block-rules';

/**
 * Einstellungen › Fokus-Sperre: whether a running stopwatch blocks, always
 * (`trigger` = `stopwatch`) or from a Soll of `thresholdMinutes` on
 * (`threshold`), Soft or Hardcore by default, and which list decides. One
 * row per person, written on the first change; without one the defaults
 * hold (on, whenever the stopwatch runs, 15, Soft, Sperrliste).
 */
@Entity('focus_block_settings')
@Check(
  'CHK_focus_block_settings_threshold',
  '"thresholdMinutes" BETWEEN 1 AND 600',
)
@Check('CHK_focus_block_settings_mode', `"mode" IN ('soft', 'hardcore')`)
@Check(
  'CHK_focus_block_settings_list_mode',
  `"listMode" IN ('blocklist', 'allowlist')`,
)
@Check(
  'CHK_focus_block_settings_trigger',
  `"trigger" IN ('stopwatch', 'threshold')`,
)
export class FocusBlockSettingsEntity {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_focus_block_settings_user',
  })
  user?: UserEntity;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'varchar', length: 16, default: 'stopwatch' })
  trigger!: FocusTriggerKind;

  @Column({ type: 'smallint', default: DEFAULT_THRESHOLD_MINUTES })
  thresholdMinutes!: number;

  @Column({ type: 'varchar', length: 16, default: 'soft' })
  mode!: FocusBlockMode;

  @Column({ type: 'varchar', length: 16, default: 'blocklist' })
  listMode!: FocusListMode;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

/**
 * One entry of the Sperrliste or the Erlaubt-Liste: an Android app by its
 * package name (with the label the phone showed), or a website by its host,
 * which covers every subdomain. They stay on this server; only the person's
 * own devices read them.
 */
@Entity('focus_block_entries')
@Unique('UQ_focus_block_entries_value', ['userId', 'list', 'kind', 'value'])
@Check('CHK_focus_block_entries_list', `"list" IN ('block', 'allow')`)
@Check('CHK_focus_block_entries_kind', `"kind" IN ('app', 'domain')`)
export class FocusBlockEntryEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_focus_block_entries_user',
  })
  user?: UserEntity;

  @Column({ type: 'varchar', length: 8 })
  list!: FocusList;

  @Column({ type: 'varchar', length: 8 })
  kind!: FocusEntryKind;

  /** Package name or host, normalized (`focus-block-rules.ts`). */
  @Column({ type: 'varchar', length: 255 })
  value!: string;

  /** An app's name as the phone showed it; null for a website. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  label!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

/**
 * A block session: started with a running stopwatch, at most one open per
 * person. Soft ends when its stopwatch pauses or ends, or by hand;
 * Hardcore when its quest or run is done, and either when its stopwatch
 * ends (no `endsAt`, stopwatch trigger) or at `endsAt` (the Soll moment,
 * threshold trigger). A block past its moment counts as over at once and
 * is closed on the next read, so no worker is needed. `title` keeps the quest's name for the block
 * screen and for a block whose target is gone.
 */
@Entity('focus_blocks')
@Index('UQ_focus_blocks_open_user', ['userId'], {
  unique: true,
  where: `"endedAt" IS NULL`,
})
@Check('CHK_focus_blocks_mode', `"mode" IN ('soft', 'hardcore')`)
@Check('CHK_focus_blocks_list_mode', `"listMode" IN ('blocklist', 'allowlist')`)
@Check('CHK_focus_blocks_ends_at', `"mode" = 'hardcore' OR "endsAt" IS NULL`)
@Check(
  'CHK_focus_blocks_end_reason',
  `("endedAt" IS NULL) = ("endReason" IS NULL)`,
)
@Check(
  'CHK_focus_blocks_reason',
  `"endReason" IN ('lifted', 'stopwatch_stopped', 'paused', 'completed', 'target_reached', 'expired')`,
)
export class FocusBlockEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_focus_blocks_user',
  })
  user?: UserEntity;

  @Index('IDX_focus_blocks_todoId')
  @Column({ type: 'integer', nullable: true })
  todoId!: number | null;

  @ManyToOne(() => TodoEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'todoId',
    foreignKeyConstraintName: 'FK_focus_blocks_todo',
  })
  todo?: TodoEntity | null;

  @Index('IDX_focus_blocks_occurrenceId')
  @Column({ type: 'integer', nullable: true })
  occurrenceId!: number | null;

  @ManyToOne(() => HabitOccurrenceEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'occurrenceId',
    foreignKeyConstraintName: 'FK_focus_blocks_occurrence',
  })
  occurrence?: HabitOccurrenceEntity | null;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 16 })
  mode!: FocusBlockMode;

  /** The list mode at the start; a later change applies to the next block. */
  @Column({ type: 'varchar', length: 16 })
  listMode!: FocusListMode;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  /** Hardcore with the threshold trigger: the Soll moment it ends at. */
  @Column({ type: 'timestamptz', nullable: true })
  endsAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  endReason!: FocusEndReason | null;
}
