import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutoRunMigrations1719100000000 implements MigrationInterface {
  name = 'AutoRunMigrations1719100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // If invoice_item doesn't exist yet, InitialSchema will create it
    // with the correct column definition — nothing to ALTER here.
    const tableExists = await queryRunner.hasTable('invoice_item');
    if (!tableExists) {
      return;
    }
    await queryRunner.query(`ALTER TABLE invoice_item ALTER COLUMN quantity SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE return_item ALTER COLUMN quantity SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE invoice_item ALTER COLUMN quantity DROP NOT NULL;
      ALTER TABLE return_item ALTER COLUMN quantity DROP NOT NULL;
    `);
  }
}
