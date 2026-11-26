import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A Google event can be ticked off in a day's list (docs/day-order.md ›
 * Google-Termine abhaken): `doneAt` is the app's own, never written to
 * Google, and a sync carries it over by the event's id like its place.
 */
export class EventDone1796900000000 implements MigrationInterface {
  name = 'EventDone1796900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "external_events"
            ADD "doneAt" TIMESTAMP WITH TIME ZONE
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "external_events" DROP COLUMN "doneAt"
        `);
  }
}
