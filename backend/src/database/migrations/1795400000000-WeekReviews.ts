import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Weekly reviews: three optional answers per user and week, the week named
 * by its Monday. Nothing to convert; the table starts empty.
 */
export class WeekReviews1795400000000 implements MigrationInterface {
  name = 'WeekReviews1795400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "week_reviews" (
                "id" SERIAL NOT NULL,
                "userId" uuid NOT NULL,
                "week" date NOT NULL,
                "wentWell" character varying(10000),
                "wentBadly" character varying(10000),
                "changeNext" character varying(10000),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_week_reviews_user_week" UNIQUE ("userId", "week"),
                CONSTRAINT "PK_27c052fe65cb1a69ad493be0f76" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "week_reviews"
            ADD CONSTRAINT "FK_f29cd7a8cbe04f8dc1e51aaeb11" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "week_reviews" DROP CONSTRAINT "FK_f29cd7a8cbe04f8dc1e51aaeb11"
        `);
    await queryRunner.query(`
            DROP TABLE "week_reviews"
        `);
  }
}
