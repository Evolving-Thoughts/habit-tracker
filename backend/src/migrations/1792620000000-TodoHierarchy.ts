import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive migration for an existing baseline. No table/data reset. */
export class TodoHierarchy1792620000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('todos')))
      throw new Error(
        'Create the existing application baseline before running this additive migration.',
      );
    await queryRunner.query(
      'ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "parentId" integer NULL',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_todos_parent" ON "todos" ("parentId")',
    );
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_todos_parent' AND conrelid = 'todos'::regclass) THEN
        ALTER TABLE "todos" ADD CONSTRAINT "FK_todos_parent" FOREIGN KEY ("parentId") REFERENCES "todos"("id") ON DELETE RESTRICT;
      END IF;
    END $$`);
  }
  down(): Promise<void> {
    return Promise.reject(
      new Error(
        'No automatic destructive rollback: preserve hierarchy data and use a verified backup/recovery procedure.',
      ),
    );
  }
}
