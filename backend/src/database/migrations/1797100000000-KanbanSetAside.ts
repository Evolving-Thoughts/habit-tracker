import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The Kampagnen-Board (docs/campaign-board.md): when a quest was last put
 * back out of "In Arbeit", when it was last taken into it by hand, and the
 * user's "Geblockt" marker.
 */
export class KanbanSetAside1797100000000 implements MigrationInterface {
  name = 'KanbanSetAside1797100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "todos"
            ADD "setAsideAt" TIMESTAMP WITH TIME ZONE
        `);
    await queryRunner.query(`
            ALTER TABLE "todos"
            ADD "startedAt" TIMESTAMP WITH TIME ZONE
        `);
    await queryRunner.query(`
            ALTER TABLE "todos"
            ADD "blocked" boolean NOT NULL DEFAULT false
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "todos" DROP COLUMN "blocked"
        `);
    await queryRunner.query(`
            ALTER TABLE "todos" DROP COLUMN "startedAt"
        `);
    await queryRunner.query(`
            ALTER TABLE "todos" DROP COLUMN "setAsideAt"
        `);
  }
}
