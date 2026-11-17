import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Timers become stopwatches: they count up, and the planned minutes are an
 * optional target instead of a deadline.
 *
 * A timer that is running or has expired at this moment ends here: a
 * countdown has no meaning as a stopwatch, and its work up to now is already
 * in the work log stretch by stretch (a running stretch is closed by the
 * second statement). Paused timers stay paused with their time worked.
 */
export class Stopwatch1795000000000 implements MigrationInterface {
  name = 'Stopwatch1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "timers"
            ADD "targetMinutes" integer,
            ADD "elapsedMilliseconds" integer NOT NULL DEFAULT 0,
            ADD "targetReachesAt" TIMESTAMP WITH TIME ZONE,
            ADD "targetReachedAt" TIMESTAMP WITH TIME ZONE
        `);
    await queryRunner.query(`
            INSERT INTO "work_logs"
              ("userId", "todoId", "occurrenceId", "title", "startedAt", "endedAt", "source")
            SELECT "userId", "todoId", "occurrenceId", "title", "segmentStartedAt",
                   LEAST("endsAt", now()), 'timer'
            FROM "timers"
            WHERE "state" = 'running' AND "segmentStartedAt" IS NOT NULL
              AND LEAST("endsAt", now()) > "segmentStartedAt"
        `);
    await queryRunner.query(`
            UPDATE "timers" SET
              "targetMinutes" = "durationMinutes",
              "elapsedMilliseconds" = CASE
                WHEN "state" = 'running' THEN GREATEST(0, "durationMinutes" * 60000
                  - (EXTRACT(EPOCH FROM ("endsAt" - LEAST("endsAt", now()))) * 1000)::integer)
                ELSE "durationMinutes" * 60000 - "remainingMilliseconds" END,
              "targetReachedAt" = "finishedAt",
              "segmentStartedAt" = NULL,
              "state" = CASE WHEN "state" = 'paused' THEN 'paused' ELSE 'stopped' END
        `);
    for (const constraint of [
      'CHK_timer_deadline',
      'CHK_timer_remaining',
      'CHK_timer_duration',
      'CHK_timer_state',
    ])
      await queryRunner.query(
        `ALTER TABLE "timers" DROP CONSTRAINT "${constraint}"`,
      );
    await queryRunner.query(`
            ALTER TABLE "timers"
            DROP COLUMN "durationMinutes",
            DROP COLUMN "remainingMilliseconds",
            DROP COLUMN "endsAt",
            DROP COLUMN "finishedAt"
        `);
    await queryRunner.query(`
            ALTER TABLE "timers"
            ADD CONSTRAINT "CHK_timer_state"
              CHECK ("state" IN ('running', 'paused', 'stopped')),
            ADD CONSTRAINT "CHK_timer_target_minutes"
              CHECK ("targetMinutes" IS NULL OR "targetMinutes" BETWEEN 1 AND 10080),
            ADD CONSTRAINT "CHK_timer_elapsed" CHECK ("elapsedMilliseconds" >= 0),
            ADD CONSTRAINT "CHK_timer_segment"
              CHECK (("state" = 'running') = ("segmentStartedAt" IS NOT NULL))
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const constraint of [
      'CHK_timer_segment',
      'CHK_timer_elapsed',
      'CHK_timer_target_minutes',
      'CHK_timer_state',
    ])
      await queryRunner.query(
        `ALTER TABLE "timers" DROP CONSTRAINT "${constraint}"`,
      );
    await queryRunner.query(`
            ALTER TABLE "timers"
            ADD "durationMinutes" integer,
            ADD "remainingMilliseconds" integer,
            ADD "endsAt" TIMESTAMP WITH TIME ZONE,
            ADD "finishedAt" TIMESTAMP WITH TIME ZONE
        `);
    // A countdown needs a duration; a stopwatch without a target becomes a
    // stopped timer of one minute. Nothing that ran as a stopwatch keeps running.
    await queryRunner.query(`
            UPDATE "timers" SET
              "durationMinutes" = COALESCE("targetMinutes", 1),
              "remainingMilliseconds" = GREATEST(
                0, COALESCE("targetMinutes", 1) * 60000 - "elapsedMilliseconds"),
              "finishedAt" = "targetReachedAt",
              "segmentStartedAt" = NULL,
              "state" = CASE WHEN "state" = 'paused' AND "targetMinutes" IS NOT NULL
                THEN 'paused' ELSE 'stopped' END
        `);
    await queryRunner.query(`
            ALTER TABLE "timers"
            ALTER COLUMN "durationMinutes" SET NOT NULL,
            ALTER COLUMN "remainingMilliseconds" SET NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "timers"
            DROP COLUMN "targetMinutes",
            DROP COLUMN "elapsedMilliseconds",
            DROP COLUMN "targetReachesAt",
            DROP COLUMN "targetReachedAt"
        `);
    await queryRunner.query(`
            ALTER TABLE "timers"
            ADD CONSTRAINT "CHK_timer_state"
              CHECK ("state" IN ('running', 'paused', 'finished', 'stopped')),
            ADD CONSTRAINT "CHK_timer_duration"
              CHECK ("durationMinutes" BETWEEN 1 AND 10080),
            ADD CONSTRAINT "CHK_timer_remaining"
              CHECK ("remainingMilliseconds" BETWEEN 0 AND "durationMinutes" * 60000),
            ADD CONSTRAINT "CHK_timer_deadline"
              CHECK (("state" = 'running') = ("endsAt" IS NOT NULL))
        `);
  }
}
