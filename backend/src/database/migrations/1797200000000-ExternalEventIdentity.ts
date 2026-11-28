import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A Google event keeps its row across syncs (docs/day-order.md › Google
 * Calendar): one row per user, calendar and event id, updated in place,
 * so its id, its place and its tick stay. Before, every sync replaced the
 * rows, so duplicates of one event could exist; of each such set the row
 * that carries a tick, else a place, else the oldest stays, and the others
 * go. Rows from before event ids (empty `eventId`) stay out of the index
 * and untouched; the next sync of their user deletes them.
 */
export class ExternalEventIdentity1797200000000 implements MigrationInterface {
  name = 'ExternalEventIdentity1797200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DELETE FROM "external_events" e
            USING (
                SELECT "id", row_number() OVER (
                    PARTITION BY "userId", "calendarId", "eventId"
                    ORDER BY ("doneAt" IS NULL), ("dayPosition" IS NULL), "id"
                ) AS rank
                FROM "external_events"
                WHERE "eventId" <> ''
            ) ranked
            WHERE e."id" = ranked."id" AND ranked.rank > 1
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_external_events_event"
            ON "external_events" ("userId", "calendarId", "eventId")
            WHERE "eventId" <> ''
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX "public"."UQ_external_events_event"
        `);
  }
}
