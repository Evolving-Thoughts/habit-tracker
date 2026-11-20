import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A category may keep a colour of its own, one of the campaign colours.
 * Without one (every existing row) the name keeps picking it, as before.
 * The campaign palette grew from ten to sixteen keys; every key stored
 * so far is still one of them, so no todo needs converting.
 */
export class CategoryColor1795600000000 implements MigrationInterface {
  name = 'CategoryColor1795600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" ADD "color" character varying(16)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "color"`);
  }
}
