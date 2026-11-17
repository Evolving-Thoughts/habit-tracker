import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Planning by day and order instead of by clock time: a todo has its day,
 * only an appointment keeps a time of day, and the place within the day is
 * a position. Removes what only the old time-based replanning used.
 */
export class DayOrder1794960000000 implements MigrationInterface {
  name = 'DayOrder1794960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "todos"
            ADD "scheduledDate" date,
            ADD "timeOfDay" character varying(5),
            ADD "dayPosition" integer
        `);
    await queryRunner.query(`
            UPDATE "todos" SET
              "scheduledDate" = ("scheduledAt" AT TIME ZONE 'Europe/Berlin')::date,
              "timeOfDay" = CASE WHEN "isFixed" THEN
                to_char("scheduledAt" AT TIME ZONE 'Europe/Berlin', 'HH24:MI') END
            WHERE "scheduledAt" IS NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "todos" DROP CONSTRAINT "CHK_todos_fixed_needs_date"
        `);
    await queryRunner.query(`
            ALTER TABLE "todos" DROP COLUMN "scheduledAt", DROP COLUMN "isFixed"
        `);
    await queryRunner.query(`
            ALTER TABLE "todos"
            ADD CONSTRAINT "CHK_todos_time_needs_date"
            CHECK ("timeOfDay" IS NULL OR "scheduledDate" IS NOT NULL)
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_todos_scheduled_date" ON "todos" ("scheduledDate")
        `);
    await queryRunner.query(`
            ALTER TABLE "habit_occurrences" ADD "dayPosition" integer
        `);
    await queryRunner.query(`
            ALTER TABLE "users" DROP COLUMN "dayEndMinutes"
        `);
    await queryRunner.query(`
            ALTER TABLE "external_calendars" DROP COLUMN "blocksPlanning"
        `);
    await queryRunner.query(`
            ALTER TABLE "external_events" DROP COLUMN "busy"
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "external_events" ADD "busy" boolean NOT NULL DEFAULT true
        `);
    await queryRunner.query(`
            ALTER TABLE "external_calendars"
            ADD "blocksPlanning" boolean NOT NULL DEFAULT false
        `);
    await queryRunner.query(`
            ALTER TABLE "users" ADD "dayEndMinutes" integer NOT NULL DEFAULT '1320'
        `);
    await queryRunner.query(`
            ALTER TABLE "habit_occurrences" DROP COLUMN "dayPosition"
        `);
    await queryRunner.query(`DROP INDEX "IDX_todos_scheduled_date"`);
    await queryRunner.query(`
            ALTER TABLE "todos" DROP CONSTRAINT "CHK_todos_time_needs_date"
        `);
    await queryRunner.query(`
            ALTER TABLE "todos"
            ADD "scheduledAt" TIMESTAMP WITH TIME ZONE,
            ADD "isFixed" boolean NOT NULL DEFAULT false
        `);
    // A todo without a time comes back at the start of its day.
    await queryRunner.query(`
            UPDATE "todos" SET
              "scheduledAt" = ("scheduledDate" + COALESCE("timeOfDay", '00:00')::time)
                AT TIME ZONE 'Europe/Berlin',
              "isFixed" = "timeOfDay" IS NOT NULL
            WHERE "scheduledDate" IS NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "todos"
            ADD CONSTRAINT "CHK_todos_fixed_needs_date"
            CHECK ("isFixed" = false OR "scheduledAt" IS NOT NULL)
        `);
    await queryRunner.query(`
            ALTER TABLE "todos"
            DROP COLUMN "scheduledDate", DROP COLUMN "timeOfDay", DROP COLUMN "dayPosition"
        `);
  }
}
