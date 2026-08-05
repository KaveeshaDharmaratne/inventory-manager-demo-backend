import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDealerContactColumns1719800000000 implements MigrationInterface {
  name = 'AddDealerContactColumns1719800000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE dealer
      ADD COLUMN IF NOT EXISTS address varchar,
      ADD COLUMN IF NOT EXISTS contact_number varchar;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE dealer
      DROP COLUMN IF EXISTS contact_number,
      DROP COLUMN IF EXISTS address;
    `);
  }
}
