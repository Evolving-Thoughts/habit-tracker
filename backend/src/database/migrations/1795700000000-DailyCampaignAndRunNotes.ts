import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A daily may name the campaign it works towards (a top-level todo), and a
 * single run of a daily keeps notes like a todo does. Both start empty, so
 * no row needs converting.
 */
export class DailyCampaignAndRunNotes1795700000000 implements MigrationInterface {
  name = 'DailyCampaignAndRunNotes1795700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "habits" ADD "campaignId" integer`);
    await queryRunner.query(
      `CREATE INDEX "IDX_habits_campaignId" ON "habits" ("campaignId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "habits" ADD CONSTRAINT "FK_habits_campaign" FOREIGN KEY ("campaignId") REFERENCES "todos"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "habit_occurrences" ADD "notes" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "habit_occurrences" DROP COLUMN "notes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "habits" DROP CONSTRAINT "FK_habits_campaign"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_habits_campaignId"`);
    await queryRunner.query(`ALTER TABLE "habits" DROP COLUMN "campaignId"`);
  }
}
