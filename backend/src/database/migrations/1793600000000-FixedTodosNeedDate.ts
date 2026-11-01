import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixedTodosNeedDate1793600000000 implements MigrationInterface {
  name = 'FixedTodosNeedDate1793600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // A Google deletion used to leave fixed todos without a date behind.
    await queryRunner.query(`
            UPDATE "todos" SET "isFixed" = false
            WHERE "isFixed" = true AND "scheduledAt" IS NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "todos" DROP CONSTRAINT IF EXISTS "CHK_todos_fixed_needs_date"
        `);
    await queryRunner.query(`
            ALTER TABLE "todos"
            ADD CONSTRAINT "CHK_todos_fixed_needs_date"
            CHECK ("isFixed" = false OR "scheduledAt" IS NOT NULL)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "todos" DROP CONSTRAINT "CHK_todos_fixed_needs_date"
        `);
  }
}
