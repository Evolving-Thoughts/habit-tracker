import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A stopwatch works in blocks: resumed within a minute of a pause, it
 * continues the block before it instead of logging a new stretch. While
 * paused it remembers where that block started, when it paused and which
 * work log holds it. Existing paused stopwatches start a new block on
 * resume, as before.
 */
export class StopwatchBlocks1795900000000 implements MigrationInterface {
  name = 'StopwatchBlocks1795900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "timers"
            ADD "blockStartedAt" TIMESTAMP WITH TIME ZONE,
            ADD "pausedAt" TIMESTAMP WITH TIME ZONE,
            ADD "workLogId" integer
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "timers"
            DROP COLUMN "workLogId",
            DROP COLUMN "pausedAt",
            DROP COLUMN "blockStartedAt"
        `);
  }
}
