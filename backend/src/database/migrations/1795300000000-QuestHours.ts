import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Quest hours: a weekly goal for the user and per campaign, and a colour and
 * icon per campaign. Only a todo without parent is a campaign, so only such
 * a todo may carry these fields.
 */
export class QuestHours1795300000000 implements MigrationInterface {
  name = 'QuestHours1795300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "todos"
            ADD "weeklyTargetMinutes" integer,
            ADD "color" character varying(16),
            ADD "icon" character varying(16),
            ADD CONSTRAINT "CHK_todos_weekly_target"
              CHECK ("weeklyTargetMinutes" IS NULL OR "weeklyTargetMinutes" BETWEEN 1 AND 6000),
            ADD CONSTRAINT "CHK_todos_campaign_fields"
              CHECK ("parentId" IS NULL OR ("weeklyTargetMinutes" IS NULL AND "color" IS NULL AND "icon" IS NULL))
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD "weeklyQuestTargetMinutes" integer,
            ADD CONSTRAINT "CHK_users_weekly_quest_target"
              CHECK ("weeklyQuestTargetMinutes" IS NULL OR "weeklyQuestTargetMinutes" BETWEEN 1 AND 6000)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "users"
            DROP CONSTRAINT "CHK_users_weekly_quest_target",
            DROP COLUMN "weeklyQuestTargetMinutes"
        `);
    await queryRunner.query(`
            ALTER TABLE "todos"
            DROP CONSTRAINT "CHK_todos_campaign_fields",
            DROP CONSTRAINT "CHK_todos_weekly_target",
            DROP COLUMN "icon",
            DROP COLUMN "color",
            DROP COLUMN "weeklyTargetMinutes"
        `);
  }
}
