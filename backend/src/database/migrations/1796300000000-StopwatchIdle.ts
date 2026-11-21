import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The short pauses inside a stopwatch's current block: its work log counts
 * them as worked, the stopwatch shows only the time it ran (`elapsedAt`).
 */
export class StopwatchIdle1796300000000 implements MigrationInterface {
  name = 'StopwatchIdle1796300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "timers"
            ADD "idleMilliseconds" integer NOT NULL DEFAULT 0,
            ADD CONSTRAINT "CHK_timer_idle" CHECK ("idleMilliseconds" >= 0)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "timers"
            DROP CONSTRAINT "CHK_timer_idle",
            DROP COLUMN "idleMilliseconds"
        `);
  }
}
