import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUnusableItemTable1719600000000 implements MigrationInterface {
  name = 'AddUnusableItemTable1719600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS unusable_item (
        item_code VARCHAR NOT NULL,
        type VARCHAR NOT NULL CHECK (type IN ('Damage', 'Expired')),
        quantity INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT now(),
        modified_at TIMESTAMP DEFAULT now(),
        PRIMARY KEY (item_code, type),
        CONSTRAINT "FK_unusable_item_item_code" FOREIGN KEY (item_code) REFERENCES item(code)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS unusable_item;`);
  }
}
