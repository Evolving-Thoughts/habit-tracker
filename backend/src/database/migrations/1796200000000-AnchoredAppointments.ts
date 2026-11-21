import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Appointments now stand in the order of their day (day-order.ts). Until
 * now their stored place meant nothing; one left over from before the todo
 * got its time would put it somewhere arbitrary. Cleared, every appointment
 * starts right after the one before it on the clock, as it showed so far.
 */
export class AnchoredAppointments1796200000000 implements MigrationInterface {
  name = 'AnchoredAppointments1796200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "todos" SET "dayPosition" = NULL WHERE "timeOfDay" IS NOT NULL`,
    );
  }

  public async down(): Promise<void> {
    // The cleared places carried no meaning; nothing to restore.
  }
}
