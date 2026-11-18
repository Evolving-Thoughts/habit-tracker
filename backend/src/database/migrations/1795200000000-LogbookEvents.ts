import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A calendar link can also tie a work log to its event in the app's own
 * calendar. Exactly one target, which until now nothing enforced.
 */
export class LogbookEvents1795200000000 implements MigrationInterface {
  name = 'LogbookEvents1795200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "calendar_links"
            ADD "workLogId" integer,
            ADD CONSTRAINT "CHK_calendar_link_target"
              CHECK (num_nonnulls("todoId", "occurrenceId", "workLogId") = 1)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DELETE FROM "calendar_links" WHERE "workLogId" IS NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "calendar_links"
            DROP CONSTRAINT "CHK_calendar_link_target",
            DROP COLUMN "workLogId"
        `);
  }
}
