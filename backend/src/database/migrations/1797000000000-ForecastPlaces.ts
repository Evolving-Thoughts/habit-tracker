import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A daily's forecast run takes a place in a later day's order before it is
 * stored (docs/day-order.md › Vorhergesagte Läufe): the run is stored only on
 * its day, since a habit has one open run at a time, and takes the place
 * over then.
 */
export class ForecastPlaces1797000000000 implements MigrationInterface {
  name = 'ForecastPlaces1797000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "habit_forecast_places" (
                "id" SERIAL NOT NULL,
                "userId" uuid NOT NULL,
                "habitId" integer NOT NULL,
                "date" date NOT NULL,
                "dayPosition" integer NOT NULL,
                CONSTRAINT "PK_habit_forecast_places" PRIMARY KEY ("id"),
                CONSTRAINT "FK_edf4893e0bf5ec331cf51957272" FOREIGN KEY ("habitId")
                    REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_5a4cfb9068b983cf01cba5f0a8"
            ON "habit_forecast_places" ("habitId", "date")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "habit_forecast_places"`);
  }
}
