import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fokus-Sperre (docs/focus-block.md): the settings (`focus_block_settings`),
 * the Sperrliste and the Erlaubt-Liste (`focus_block_entries`), the block
 * sessions (`focus_blocks`, at most one open per person) and each quest's
 * and daily's own choice (`focusBlock`: default, always, never). Existing
 * quests and dailies follow the default rule; the new tables start empty,
 * so nothing blocks until a person switches it on.
 */
export class FocusBlocks1796600000000 implements MigrationInterface {
  name = 'FocusBlocks1796600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "todos"
            ADD "focusBlock" character varying(8) NOT NULL DEFAULT 'default',
            ADD CONSTRAINT "CHK_todos_focus_block"
              CHECK ("focusBlock" IN ('default', 'always', 'never'))
        `);
    await queryRunner.query(`
            ALTER TABLE "habits"
            ADD "focusBlock" character varying(8) NOT NULL DEFAULT 'default',
            ADD CONSTRAINT "CHK_habits_focus_block"
              CHECK ("focusBlock" IN ('default', 'always', 'never'))
        `);
    await queryRunner.query(`
            CREATE TABLE "focus_block_settings" (
                "userId" uuid NOT NULL,
                "enabled" boolean NOT NULL DEFAULT false,
                "thresholdMinutes" smallint NOT NULL DEFAULT '15',
                "mode" character varying(16) NOT NULL DEFAULT 'soft',
                "listMode" character varying(16) NOT NULL DEFAULT 'blocklist',
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_focus_block_settings_threshold"
                  CHECK ("thresholdMinutes" BETWEEN 1 AND 600),
                CONSTRAINT "CHK_focus_block_settings_mode"
                  CHECK ("mode" IN ('soft', 'hardcore')),
                CONSTRAINT "CHK_focus_block_settings_list_mode"
                  CHECK ("listMode" IN ('blocklist', 'allowlist')),
                CONSTRAINT "PK_4d51187cea0d8f31e4a7eb1b13b" PRIMARY KEY ("userId")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "focus_block_settings"
            ADD CONSTRAINT "FK_focus_block_settings_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            CREATE TABLE "focus_block_entries" (
                "id" SERIAL NOT NULL,
                "userId" uuid NOT NULL,
                "list" character varying(8) NOT NULL,
                "kind" character varying(8) NOT NULL,
                "value" character varying(255) NOT NULL,
                "label" character varying(200),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_focus_block_entries_value" UNIQUE ("userId", "list", "kind", "value"),
                CONSTRAINT "CHK_focus_block_entries_list"
                  CHECK ("list" IN ('block', 'allow')),
                CONSTRAINT "CHK_focus_block_entries_kind"
                  CHECK ("kind" IN ('app', 'domain')),
                CONSTRAINT "PK_fec35f56eedeefd32f526d696fd" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "focus_block_entries"
            ADD CONSTRAINT "FK_focus_block_entries_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            CREATE TABLE "focus_blocks" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "userId" uuid NOT NULL,
                "todoId" integer,
                "occurrenceId" integer,
                "title" character varying(200) NOT NULL,
                "mode" character varying(16) NOT NULL,
                "listMode" character varying(16) NOT NULL,
                "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "endsAt" TIMESTAMP WITH TIME ZONE,
                "endedAt" TIMESTAMP WITH TIME ZONE,
                "endReason" character varying(24),
                CONSTRAINT "CHK_focus_blocks_mode"
                  CHECK ("mode" IN ('soft', 'hardcore')),
                CONSTRAINT "CHK_focus_blocks_list_mode"
                  CHECK ("listMode" IN ('blocklist', 'allowlist')),
                CONSTRAINT "CHK_focus_blocks_ends_at"
                  CHECK (("mode" = 'hardcore') = ("endsAt" IS NOT NULL)),
                CONSTRAINT "CHK_focus_blocks_end_reason"
                  CHECK (("endedAt" IS NULL) = ("endReason" IS NULL)),
                CONSTRAINT "CHK_focus_blocks_reason"
                  CHECK ("endReason" IN ('lifted', 'stopwatch_stopped', 'completed', 'target_reached', 'expired')),
                CONSTRAINT "PK_aa57ee4a8eb29ec08d222e7ffff" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_focus_blocks_open_user" ON "focus_blocks" ("userId")
            WHERE "endedAt" IS NULL
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_focus_blocks_todoId" ON "focus_blocks" ("todoId")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_focus_blocks_occurrenceId" ON "focus_blocks" ("occurrenceId")
        `);
    await queryRunner.query(`
            ALTER TABLE "focus_blocks"
            ADD CONSTRAINT "FK_focus_blocks_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "focus_blocks"
            ADD CONSTRAINT "FK_focus_blocks_todo" FOREIGN KEY ("todoId") REFERENCES "todos"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "focus_blocks"
            ADD CONSTRAINT "FK_focus_blocks_occurrence" FOREIGN KEY ("occurrenceId") REFERENCES "habit_occurrences"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP TABLE "focus_blocks"
        `);
    await queryRunner.query(`
            DROP TABLE "focus_block_entries"
        `);
    await queryRunner.query(`
            DROP TABLE "focus_block_settings"
        `);
    await queryRunner.query(`
            ALTER TABLE "habits"
            DROP CONSTRAINT "CHK_habits_focus_block",
            DROP COLUMN "focusBlock"
        `);
    await queryRunner.query(`
            ALTER TABLE "todos"
            DROP CONSTRAINT "CHK_todos_focus_block",
            DROP COLUMN "focusBlock"
        `);
  }
}
