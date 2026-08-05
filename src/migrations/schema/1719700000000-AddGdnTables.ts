import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGdnTables1719700000000 implements MigrationInterface {
  name = 'AddGdnTables1719700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS gdn (
        gdn_number VARCHAR NOT NULL PRIMARY KEY,
        date DATE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS gdn_item (
        gdn_number VARCHAR NOT NULL,
        item_code VARCHAR NOT NULL,
        quantity INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT now(),
        modified_at TIMESTAMP DEFAULT now(),
        PRIMARY KEY (gdn_number, item_code),
        CONSTRAINT "FK_gdn_item_gdn_number" FOREIGN KEY (gdn_number) REFERENCES gdn(gdn_number),
        CONSTRAINT "FK_gdn_item_item_code" FOREIGN KEY (item_code) REFERENCES item(code)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS gdn_item;');
    await queryRunner.query('DROP TABLE IF EXISTS gdn;');
  }
}
