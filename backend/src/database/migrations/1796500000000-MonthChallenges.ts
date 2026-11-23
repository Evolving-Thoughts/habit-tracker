import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Monats-Challenge: one Daily per person and calendar month
 * (`month_challenges`, see docs/challenges.md), and its daily reminder as a
 * push delivery of its own kind. A reminder names its day like the one of
 * "Das Beste des Tages", so a device may now hold one delivery per kind and
 * day. The new table starts empty; existing deliveries stay as they are.
 */
export class MonthChallenges1796500000000 implements MigrationInterface {
  name = 'MonthChallenges1796500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "month_challenges" (
                "id" SERIAL NOT NULL,
                "userId" uuid NOT NULL,
                "habitId" integer,
                "month" date NOT NULL,
                "startDate" date NOT NULL,
                "title" character varying(200) NOT NULL,
                "reminderMinutes" smallint,
                "remindedOn" date,
                "doneCount" integer,
                "dueCount" integer,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "endedAt" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "UQ_month_challenges_user_month" UNIQUE ("userId", "month"),
                CONSTRAINT "CHK_month_challenges_reminder_minutes"
                  CHECK ("reminderMinutes" BETWEEN 0 AND 1439),
                CONSTRAINT "CHK_month_challenges_result"
                  CHECK (("doneCount" IS NULL AND "dueCount" IS NULL) OR ("doneCount" >= 0 AND "doneCount" <= "dueCount")),
                CONSTRAINT "PK_bb2975d3eebbc7df01434c6a9b6" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_month_challenges_habitId" ON "month_challenges" ("habitId")
        `);
    await queryRunner.query(`
            ALTER TABLE "month_challenges"
            ADD CONSTRAINT "FK_month_challenges_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "month_challenges"
            ADD CONSTRAINT "FK_month_challenges_habit" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "push_deliveries"
            DROP CONSTRAINT "CHK_push_delivery_kind",
            ADD CONSTRAINT "CHK_push_delivery_kind" CHECK (
                ("kind" = 'timer' AND "timerId" IS NOT NULL AND "day" IS NULL)
                OR ("kind" IN ('day-best', 'challenge') AND "timerId" IS NULL AND "day" IS NOT NULL)
            )
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_2f12a580c18ba24f7b8f510d5e"
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_1244aa5f23b3e7300a1495205a" ON "push_deliveries" ("subscriptionId", "kind", "day")
        `);
  }

  /** Challenge reminders have no kind to go back to: they go. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DELETE FROM "push_deliveries" WHERE "kind" = 'challenge'
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_1244aa5f23b3e7300a1495205a"
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_2f12a580c18ba24f7b8f510d5e" ON "push_deliveries" ("subscriptionId", "day")
        `);
    await queryRunner.query(`
            ALTER TABLE "push_deliveries"
            DROP CONSTRAINT "CHK_push_delivery_kind",
            ADD CONSTRAINT "CHK_push_delivery_kind" CHECK (
                ("kind" = 'timer' AND "timerId" IS NOT NULL AND "day" IS NULL)
                OR ("kind" = 'day-best' AND "timerId" IS NULL AND "day" IS NOT NULL)
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "month_challenges" DROP CONSTRAINT "FK_month_challenges_habit"
        `);
    await queryRunner.query(`
            ALTER TABLE "month_challenges" DROP CONSTRAINT "FK_month_challenges_user"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_month_challenges_habitId"
        `);
    await queryRunner.query(`
            DROP TABLE "month_challenges"
        `);
  }
}
