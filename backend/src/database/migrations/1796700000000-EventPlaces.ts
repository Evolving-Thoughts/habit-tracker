import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Google events take a place in the order of the day (docs/day-order.md ›
 * Google-Termine in der Reihenfolge): `eventId` names the event in its
 * Google calendar, so the place (`dayPosition`) survives every sync, which
 * replaces the rows. Existing rows get their id at the next sync; until
 * then they have no place and stand by the clock, as before.
 */
export class EventPlaces1796700000000 implements MigrationInterface {
  name = 'EventPlaces1796700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "external_events"
            ADD "eventId" character varying(1024) NOT NULL DEFAULT '',
            ADD "dayPosition" integer
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "external_events"
            DROP COLUMN "dayPosition",
            DROP COLUMN "eventId"
        `);
  }
}
