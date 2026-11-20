import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The search compares text without accents ("uberarbeiten" finds
 * "Überarbeiten") through PostgreSQL's `unaccent`. Where the extension
 * cannot be installed, the migration still passes and the search falls back
 * to comparing in lower case only (`search.service.ts` checks at run time).
 */
export class SearchUnaccent1796100000000 implements MigrationInterface {
  name = 'SearchUnaccent1796100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DO $$
            BEGIN
              CREATE EXTENSION IF NOT EXISTS unaccent;
            EXCEPTION WHEN OTHERS THEN
              RAISE NOTICE 'unaccent is not available; search compares in lower case only';
            END
            $$
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS unaccent`);
  }
}
