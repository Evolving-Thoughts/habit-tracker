import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The Questlog keeps the order the user sorts it into. Every todo without
 * a day takes its place in the order it was created, so a quest that joins
 * later lands at the end.
 */
export class BacklogOrder1795800000000 implements MigrationInterface {
  name = 'BacklogOrder1795800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "todos" ADD "backlogPosition" integer`,
    );
    await queryRunner.query(
      `UPDATE "todos" SET "backlogPosition" = "ranked"."position"
       FROM (
         SELECT "id", ROW_NUMBER() OVER (
           PARTITION BY "userId" ORDER BY "createdAt", "id"
         ) - 1 AS "position"
         FROM "todos"
         WHERE "scheduledDate" IS NULL
       ) AS "ranked"
       WHERE "todos"."id" = "ranked"."id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "todos" DROP COLUMN "backlogPosition"`,
    );
  }
}
