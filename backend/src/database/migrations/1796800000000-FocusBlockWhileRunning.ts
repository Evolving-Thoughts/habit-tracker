import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fokus-Sperre blocks whenever a stopwatch runs (docs/focus-block.md):
 * `focus_block_settings.trigger` chooses between that (`stopwatch`, the new
 * default) and the earlier rule from a Soll on (`threshold`). Every existing
 * row moves to `stopwatch`; its `enabled` stays as the person set it (a row
 * is only written by a change in Einstellungen, so there is no way to tell
 * an untouched "off"). People without a row get the new defaults: on.
 * Blocks may now end on a pause (`paused`), and Hardcore may run without a
 * Soll moment (it then ends with its stopwatch).
 */
export class FocusBlockWhileRunning1796800000000 implements MigrationInterface {
  name = 'FocusBlockWhileRunning1796800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "focus_block_settings"
            ADD "trigger" character varying(16) NOT NULL DEFAULT 'stopwatch',
            ADD CONSTRAINT "CHK_focus_block_settings_trigger"
              CHECK ("trigger" IN ('stopwatch', 'threshold')),
            ALTER COLUMN "enabled" SET DEFAULT true
        `);
    await queryRunner.query(`
            ALTER TABLE "focus_blocks"
            DROP CONSTRAINT "CHK_focus_blocks_ends_at",
            ADD CONSTRAINT "CHK_focus_blocks_ends_at"
              CHECK ("mode" = 'hardcore' OR "endsAt" IS NULL),
            DROP CONSTRAINT "CHK_focus_blocks_reason",
            ADD CONSTRAINT "CHK_focus_blocks_reason"
              CHECK ("endReason" IN ('lifted', 'stopwatch_stopped', 'paused', 'completed', 'target_reached', 'expired'))
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Blocks of the new kinds have no place in the old rules.
    await queryRunner.query(`
            UPDATE "focus_blocks" SET "endReason" = 'stopwatch_stopped'
            WHERE "endReason" = 'paused'
        `);
    await queryRunner.query(`
            UPDATE "focus_blocks" SET "mode" = 'soft'
            WHERE "mode" = 'hardcore' AND "endsAt" IS NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "focus_blocks"
            DROP CONSTRAINT "CHK_focus_blocks_reason",
            ADD CONSTRAINT "CHK_focus_blocks_reason"
              CHECK ("endReason" IN ('lifted', 'stopwatch_stopped', 'completed', 'target_reached', 'expired')),
            DROP CONSTRAINT "CHK_focus_blocks_ends_at",
            ADD CONSTRAINT "CHK_focus_blocks_ends_at"
              CHECK (("mode" = 'hardcore') = ("endsAt" IS NOT NULL))
        `);
    await queryRunner.query(`
            ALTER TABLE "focus_block_settings"
            ALTER COLUMN "enabled" SET DEFAULT false,
            DROP CONSTRAINT "CHK_focus_block_settings_trigger",
            DROP COLUMN "trigger"
        `);
  }
}
