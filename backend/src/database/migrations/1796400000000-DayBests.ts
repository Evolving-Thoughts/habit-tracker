import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Das Beste des Tages": one short line per person and day (`day_bests`),
 * the settings around it (`day_best_settings`: from when Heute asks, the
 * evening reminder and the day it was last handled), and push deliveries
 * that are not about a stopwatch: a delivery now has a `kind`, and the
 * evening reminder names its `day` instead of a timer. Existing deliveries
 * are all timer deliveries. The new tables start empty.
 */
export class DayBests1796400000000 implements MigrationInterface {
  name = 'DayBests1796400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "day_bests" (
                "id" SERIAL NOT NULL,
                "userId" uuid NOT NULL,
                "date" date NOT NULL,
                "text" character varying(280) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_day_bests_user_date" UNIQUE ("userId", "date"),
                CONSTRAINT "CHK_day_bests_text" CHECK ("text" <> ''),
                CONSTRAINT "PK_824f0c99b2f1802f2706bd802fa" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "day_bests"
            ADD CONSTRAINT "FK_108b101a59c3dc9cb28d7d36536" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            CREATE TABLE "day_best_settings" (
                "userId" uuid NOT NULL,
                "cardMinutes" smallint NOT NULL DEFAULT '1200',
                "reminderEnabled" boolean NOT NULL DEFAULT true,
                "remindedOn" date,
                CONSTRAINT "CHK_day_best_settings_card_minutes"
                  CHECK ("cardMinutes" BETWEEN 0 AND 1439),
                CONSTRAINT "PK_036f1f1ea86533e7d064efe9583" PRIMARY KEY ("userId")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "day_best_settings"
            ADD CONSTRAINT "FK_036f1f1ea86533e7d064efe9583" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "push_deliveries"
            ADD "kind" character varying(16) NOT NULL DEFAULT 'timer',
            ADD "day" date,
            ALTER COLUMN "timerId" DROP NOT NULL,
            ADD CONSTRAINT "CHK_push_delivery_kind" CHECK (
                ("kind" = 'timer' AND "timerId" IS NOT NULL AND "day" IS NULL)
                OR ("kind" = 'day-best' AND "timerId" IS NULL AND "day" IS NOT NULL)
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_2f12a580c18ba24f7b8f510d5e" ON "push_deliveries" ("subscriptionId", "day")
        `);
  }

  /** Reminder deliveries have no timer to go back to: they go. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DELETE FROM "push_deliveries" WHERE "kind" <> 'timer'
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_2f12a580c18ba24f7b8f510d5e"
        `);
    await queryRunner.query(`
            ALTER TABLE "push_deliveries"
            DROP CONSTRAINT "CHK_push_delivery_kind",
            ALTER COLUMN "timerId" SET NOT NULL,
            DROP COLUMN "day",
            DROP COLUMN "kind"
        `);
    await queryRunner.query(`
            ALTER TABLE "day_best_settings" DROP CONSTRAINT "FK_036f1f1ea86533e7d064efe9583"
        `);
    await queryRunner.query(`
            DROP TABLE "day_best_settings"
        `);
    await queryRunner.query(`
            ALTER TABLE "day_bests" DROP CONSTRAINT "FK_108b101a59c3dc9cb28d7d36536"
        `);
    await queryRunner.query(`
            DROP TABLE "day_bests"
        `);
  }
}
