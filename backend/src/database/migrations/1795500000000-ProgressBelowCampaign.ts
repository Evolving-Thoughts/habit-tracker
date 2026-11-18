import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Progress now counts only the quests below a campaign, never the campaign
 * itself (`goal-scope.ts`). Stored snapshots counted it, and an old row
 * cannot be corrected exactly: whether the campaign was done on that day is
 * lost once it was reopened. Wrong history is worse than none, so the rows
 * go; the snapshot job writes today's again, and the weekly review reads
 * earlier weeks back from the todos (`source: 'reconstructed'`) until new
 * snapshots exist. Only test data had been stored.
 */
export class ProgressBelowCampaign1795500000000 implements MigrationInterface {
  name = 'ProgressBelowCampaign1795500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "goal_snapshots"`);
  }

  /** The deleted rows cannot come back; the schema is unchanged. */
  public async down(): Promise<void> {}
}
