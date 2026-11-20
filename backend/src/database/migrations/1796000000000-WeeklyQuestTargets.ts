import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The overall weekly goal gets a history, so changing it no longer rewrites
 * the weeks that are over. Each row holds from its Monday on; a week's goal
 * is the latest row that began on or before it. Every user's goal so far
 * becomes one row valid from a Monday long before the app existed
 * (3 January 2000), and the column on `users` goes: the table is the one
 * place the goal lives.
 */
export class WeeklyQuestTargets1796000000000 implements MigrationInterface {
  name = 'WeeklyQuestTargets1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "weekly_quest_targets" (
                "userId" uuid NOT NULL,
                "validFrom" date NOT NULL,
                "minutes" integer,
                CONSTRAINT "CHK_weekly_quest_targets_minutes"
                  CHECK ("minutes" IS NULL OR "minutes" BETWEEN 1 AND 6000),
                CONSTRAINT "CHK_weekly_quest_targets_monday"
                  CHECK (EXTRACT(ISODOW FROM "validFrom") = 1),
                CONSTRAINT "PK_49b3e04e3428bf15aef07a860dc" PRIMARY KEY ("userId", "validFrom")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "weekly_quest_targets"
            ADD CONSTRAINT "FK_e738f48cbb6d9e3f6d25f9dcd04" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            INSERT INTO "weekly_quest_targets" ("userId", "validFrom", "minutes")
            SELECT "id", DATE '2000-01-03', "weeklyQuestTargetMinutes"
            FROM "users"
            WHERE "weeklyQuestTargetMinutes" IS NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            DROP CONSTRAINT "CHK_users_weekly_quest_target",
            DROP COLUMN "weeklyQuestTargetMinutes"
        `);
  }

  /** Back to one value per user: the goal of the running week. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD "weeklyQuestTargetMinutes" integer,
            ADD CONSTRAINT "CHK_users_weekly_quest_target"
              CHECK ("weeklyQuestTargetMinutes" IS NULL OR "weeklyQuestTargetMinutes" BETWEEN 1 AND 6000)
        `);
    await queryRunner.query(`
            UPDATE "users" SET "weeklyQuestTargetMinutes" = "current"."minutes"
            FROM (
              SELECT DISTINCT ON ("userId") "userId", "minutes"
              FROM "weekly_quest_targets"
              WHERE "validFrom" <= (now() AT TIME ZONE 'Europe/Berlin')::date
              ORDER BY "userId", "validFrom" DESC
            ) AS "current"
            WHERE "users"."id" = "current"."userId"
        `);
    await queryRunner.query(`
            ALTER TABLE "weekly_quest_targets" DROP CONSTRAINT "FK_e738f48cbb6d9e3f6d25f9dcd04"
        `);
    await queryRunner.query(`
            DROP TABLE "weekly_quest_targets"
        `);
  }
}
