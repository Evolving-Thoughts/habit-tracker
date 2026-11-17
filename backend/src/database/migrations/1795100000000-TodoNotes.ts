import { MigrationInterface, QueryRunner } from 'typeorm';

/** Rich-text notes of a todo, stored as the editor's document. */
export class TodoNotes1795100000000 implements MigrationInterface {
  name = 'TodoNotes1795100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "todos" ADD "notes" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "todos" DROP COLUMN "notes"`);
  }
}
